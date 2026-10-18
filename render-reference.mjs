import fs from 'node:fs';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const pdf=await getDocument({data:new Uint8Array(fs.readFileSync('C:/Users/DELL/Downloads/JANANEE_Pink_Rose_Cake_Invoice_Bawantha_Dulara.pdf')),useSystemFonts:true}).promise;
const page=await pdf.getPage(1),viewport=page.getViewport({scale:1.5}),canvas=createCanvas(viewport.width,viewport.height);
await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
fs.writeFileSync('invoice-reference.png',canvas.toBuffer('image/png'));
