import {mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'public','vendor');
await mkdir(path.join(target,'pdfjs'),{recursive:true});
for(const file of ['pdf.mjs','pdf.worker.mjs'])await copyFile(path.join(root,'node_modules','pdfjs-dist','legacy','build',file),path.join(target,'pdfjs',file));
await copyFile(path.join(root,'node_modules','pdfjs-dist','web','pdf_viewer.css'),path.join(target,'pdf-viewer.css'));
console.log('Interface e leitor PDF preparados para publicação.');
