// Applies the change set staged in edits/ to the repository, then empties edits/.
// Changes reach this repository through a connector that can only write whole text files, one at a time.
// Staging them here lets every file change in one commit, and keeps each change small.
//
//   edits/files/<path>   whole files, copied to <path>
//   edits/*.edit         search-and-replace blocks, applied in name order
//   edits/APPLY          one line per changed file: "<git blob sha> <path>"
//
// Nothing is kept unless every file listed in edits/APPLY ends up with the listed hash.
//
// Edit format:
//   === path/to/file
//   <<<<
//   text to find (must occur exactly once in the file)
//   ====
//   text to put in its place
//   >>>>
// A line holding only "...." splits the text to find into a start and an end.
// Everything from the start through the end is then replaced.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.argv[2] || '.');
const inbox = path.join(root, 'edits');
const manifest = path.join(inbox, 'APPLY');
if (!fs.existsSync(manifest)) { console.log('No edits/APPLY, nothing to apply.'); process.exit(0); }

const fail = (m) => { console.error('apply-edits: ' + m); process.exit(1); };
const blobSha = (buf) => crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);

const filesDir = path.join(inbox, 'files');
for (const f of walk(filesDir)) {
  const rel = path.relative(filesDir, f); const to = path.join(root, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(f, to); console.log('file  ' + rel);
}

for (const name of fs.readdirSync(inbox).filter((n) => n.endsWith('.edit')).sort()) {
  const lines = fs.readFileSync(path.join(inbox, name), 'utf8').split('\n');
  let file = null; let text = null; let blocks = 0;
  const save = () => { if (file) fs.writeFileSync(path.join(root, file), text); };
  const once = (needle, where) => {
    const at = text.indexOf(needle);
    if (!needle || at < 0 || text.indexOf(needle, at + 1) >= 0) fail(name + ': the text to find must occur exactly once in ' + file + ' (' + where + ')');
    return at;
  };
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('=== ')) { save(); file = lines[i].slice(4).trim(); text = fs.readFileSync(path.join(root, file), 'utf8'); continue; }
    if (lines[i] !== '<<<<') continue;
    const mid = lines.indexOf('====', i); const end = lines.indexOf('>>>>', mid);
    if (!file || mid < 0 || end < 0) fail(name + ': broken block at line ' + (i + 1));
    const find = lines.slice(i + 1, mid); const put = lines.slice(mid + 1, end).join('\n'); const cut = find.indexOf('....'); const where = 'block at line ' + (i + 1);
    let a; let b;
    if (cut < 0) { const old = find.join('\n'); a = once(old, where); b = a + old.length; }
    else {
      const head = find.slice(0, cut).join('\n'); const tail = find.slice(cut + 1).join('\n');
      a = once(head, where); const e = text.indexOf(tail, a + head.length);
      if (!tail || e < 0) fail(name + ': end of range not found in ' + file + ' (' + where + ')');
      b = e + tail.length;
    }
    text = text.slice(0, a) + put + text.slice(b); blocks++; i = end;
  }
  save(); console.log('edit  ' + name + ': ' + blocks + ' blocks');
}

let bad = 0;
for (const row of fs.readFileSync(manifest, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) {
  const gap = row.indexOf(' '); const sha = row.slice(0, gap); const rel = row.slice(gap + 1).trim(); const f = path.join(root, rel);
  const got = fs.existsSync(f) ? blobSha(fs.readFileSync(f)) : 'missing';
  if (got === sha) console.log('ok    ' + rel); else { bad++; console.error('MISMATCH ' + rel + ': expected ' + sha + ', got ' + got); }
}
if (bad) fail(bad + ' file(s) do not match edits/APPLY. Nothing is committed.');
fs.rmSync(inbox, { recursive: true, force: true });
console.log('Applied. edits/ is empty again.');
