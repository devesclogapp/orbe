const fs = require('fs');

const files = [
    "y:\\2026\\ERP ESC LOG\\Orbe\\src\\pages\\LancamentoProducao.tsx",
    "y:\\2026\\ERP ESC LOG\\Orbe\\src\\pages\\Producao\\Operacoes.tsx",
    "y:\\2026\\ERP ESC LOG\\Orbe\\src\\components\\operacoes\\OperacoesTableBlock.tsx"
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        try {
            // Convert latin1 to utf8
            const fixedStr = Buffer.from(content, 'binary').toString('utf8');
            // Check if it has any valid utf-8 chars that were garbled
            if (fixedStr.includes('ç') || fixedStr.includes('ã') || fixedStr.includes('õ')) {
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
            'serviÃ§os': 'serviços',
            'ServiÃ§os': 'Serviços',
            'AvanÃ§ar': 'Avançar',
            'operaÃ§Ã£o': 'operação',
            'OperaÃ§Ã£o': 'Operação',
            'AprovaÃ§Ã£o': 'Aprovação',
            'aprovaÃ§Ã£o': 'aprovação',
            'LanÃ§amento': 'Lançamento',
            'lanÃ§amento': 'lançamento',
            'LanÃ§amentos': 'Lançamentos',
            'lanÃ§adas': 'lançadas',
            'lanÃ§ada': 'lançada',
            'produÃ§Ã£o': 'produção',
            'ProduÃ§Ã£o': 'Produção',
            'Penda\u00AAncias': 'Pendências',
            'PendÃªncias': 'Pendências',
            'DescriÃ§Ã£o': 'Descrição',
            'formulÃ¡rio': 'formulário',
            'SaÃ\u00ADda': 'Saída',
            'SaÃda': 'Saída',
            'ConcluÃ\u00ADdo': 'Concluído',
            'ConcluÃdo': 'Concluído',
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
            'Ãº': 'ú'
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
