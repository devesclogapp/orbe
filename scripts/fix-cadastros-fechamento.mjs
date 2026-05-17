import fs from "fs";

const files = [
  "src/pages/CentralCadastros.tsx",
  "src/pages/Fechamento.tsx",
];

const pairLike = /[ÃÂ][\u0080-\u00FF]/g;

function repair(text) {
  let out = text;
  for (let i = 0; i < 4; i += 1) {
    const prev = out;
    out = out.replace(pairLike, (m) => Buffer.from(m, "latin1").toString("utf8"));
    if (out === prev) break;
  }

  // Known leftovers from prior broken decodes.
  out = out
    .replaceAll("PRODU�!ÃO", "PRODUÇÃO")
    .replaceAll("OPERA�!ÃO", "OPERAÇÃO")
    .replaceAll("DESCRI�!ÃO", "DESCRIÇÃO")
    .replaceAll("�!ÃO", "ÇÃO")
    .replaceAll("ParÃ¢metros", "Parâmetros")
    .replaceAll("ENDEREÃ‡O", "ENDEREÇO")
    .replaceAll("Ãšltima", "Última")
    .replaceAll("Ã¢â‚¬â€", "—")
    .replaceAll("ââ‚¬â€", "—");

  return out;
}

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const fixed = repair(src);
  if (fixed !== src) {
    fs.writeFileSync(file, fixed, "utf8");
    console.log(`fixed: ${file}`);
  } else {
    console.log(`nochange: ${file}`);
  }
}
