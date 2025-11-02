export function getTesseract(){
  const t = typeof window !== 'undefined' ? window.Tesseract : undefined;
  if(!t) throw new Error('Tesseract not loaded');
  return t;
}

export async function recognize(image, lang='eng', options={}){
  const t = getTesseract();
  const opts = Object.assign({ logger: ()=>{} }, options||{});
  const res = await t.recognize(image, lang, opts);
  return res;
}

export async function createWorker(lang='eng'){
  const t = getTesseract();
  const worker = await t.createWorker(lang);
  return worker;
}
