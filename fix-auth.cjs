const fs = require("fs");
const p = "c:/Users/TI6/Desktop/Gabriel/Gestão da Qualidade 2/quality-gateway/src/lib/auth.ts";
let s = fs.readFileSync(p, "utf8");
s = s.split("      permExcluirDocumentos: colaborador.perm_excluir_documentos,")
  .join("      permExcluirDocumentos: colaborador.perm_excluir_documentos,\n      permExcluirPlanos: colaborador.perm_excluir_planos,");
s = s.split("        sessionBase.permExcluirDocumentos = colaborador.perm_excluir_documentos;")
  .join("        sessionBase.permExcluirDocumentos = colaborador.perm_excluir_documentos;\n        sessionBase.permExcluirPlanos = colaborador.perm_excluir_planos;");
s = s.split("    permExcluirDocumentos: false,")
  .join("    permExcluirDocumentos: false,\n    permExcluirPlanos: false,");
s = s.split('| "perm_excluir_documentos"')
  .join('| "perm_excluir_documentos"\n    | "perm_excluir_planos"');
s = s.split("perm_adicionar_documentos,perm_modificar_documentos,perm_excluir_documentos")
  .join("perm_adicionar_documentos,perm_modificar_documentos,perm_excluir_documentos,perm_excluir_planos");
fs.writeFileSync(p, s);
console.log("auth ok");
