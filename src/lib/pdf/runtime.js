export function getPDFJS(){
  const lib = typeof window !== 'undefined' ? window.pdfjsLib : undefined;
  if(!lib) throw new Error('PDF.js not loaded');
  return lib;
}

export function configureWorker(workerSrc){
  const lib = getPDFJS();
  if(lib.GlobalWorkerOptions){ lib.GlobalWorkerOptions.workerSrc = workerSrc; }
}

export function getDocument(params){
  return getPDFJS().getDocument(params);
}

export function getPDFLib(){
  const lib = typeof window !== 'undefined' ? window.PDFLib : undefined;
  if(!lib) throw new Error('PDFLib not loaded');
  return lib;
}
