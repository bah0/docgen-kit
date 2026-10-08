import { createGotenbergRenderer, createPdfRequestHandler, createPdfService } from "docgen-kit/server";

// The whole PDF pipeline (validation, Handlebars, HTML, Gotenberg, AcroForm fields) lives in docgen-kit;
// this route only wires it to the environment. The live preview never calls it: it is only used by
// "Compare PDF".
//
//   Lexical (editor state) --export--> template string with {{placeholders}}
//     --> browser: DocumentPreview renders it locally (iframe)
//     --> server:  this route --> Handlebars --> index.html --> Gotenberg --> (pdf-lib form fields) --> PDF

const service = createPdfService({
  renderer: createGotenbergRenderer({ url: process.env.GOTENBERG_URL || undefined }),
});

export const POST = createPdfRequestHandler(service);
