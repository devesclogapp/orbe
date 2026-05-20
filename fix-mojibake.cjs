const fs = require('fs');

const files = [
    "y:\\2026\\ERP ESC LOG\\Orbe\\src\\components\\operacoes\\ServicosExtrasTableBlock.tsx",
    "y:\\2026\\ERP ESC LOG\\Orbe\\src\\pages\\Producao\\ServicosExtrasLancamento.tsx",
    "y:\\2026\\ERP ESC LOG\\Orbe\\src\\contexts\\OperationalPipelineContext.tsx"
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        try {
            // Convert latin1 to utf8
            const fixedStr = Buffer.from(content, 'binary').toString('utf8');
            // Check if it has any valid utf-8 chars that were garbled
            if (fixedStr.includes('ç') || fixedStr.includes('ã') || fixedStr.includes('õ') || fixedStr.includes('ç')) {
                if (fixedStr !== content) {
                    console.log(`Fixing double encoding for ${file}`);
                    fs.writeFileSync(file, fixedStr, 'utf8');
                    continue;
                }
            }
        } catch (e) {
        }

        // Manual replacements just in case
        const map = {
            'AÃ§Ãµes': 'Ações',
            'AtualizaÃ§Ã£o': 'Atualização',
            'DevoluÃ§Ã£o': 'Devolução',
            'devoluÃ§Ã£o': 'devolução',
            'revisÃ£o': 'revisão',
            'descriÃ§Ã£o': 'descrição',
            'alteraÃ§Ãµes': 'alterações',
            'ediÃ§Ã£o': 'edição',
            'ServiÃ§o': 'Serviço',
            'serviÃ§o': 'serviço',
            'AvanÃ§ar': 'Avançar',
            'operaÃ§Ã£o': 'operação',
            'OperaÃ§Ã£o': 'Operação',
            'AprovaÃ§Ã£o': 'Aprovação',
            'aprovaÃ§Ã£o': 'aprovação',
            'Lançamento': 'Lançamento', // keeping good
            'LanÃ§amento': 'Lançamento',
            'çÃ£o': 'ção',
            'Ã§Ã£': 'çã',
            'Ã§Ãµ': 'çõ',
            'Ã§': 'ç',
            'Ã£': 'ã',
            'Ãµ': 'õ',
            'Ã¡': 'á',
            'Ã©': 'é',
            'Ã³': 'ó',
            'Ã­': 'í',
            'Ãª': 'ê',
            'Ã¢': 'â',
            'Ã´': 'ô',
        };

        let modified = false;
        for (const [bad, good] of Object.entries(map)) {
            if (content.includes(bad)) {
                content = content.split(bad).join(good);
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Fixed manual replacements for ${file}`);
        }
    }
}
