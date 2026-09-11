import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  Packer
} from 'docx';

export interface CartaAnuenciaData {
  numeroTitulo: string;
  tipoDocumento: string;
  dataVencimento: string;
  valorNominal: number | string;
  nomeSacado: string;
  cnpjSacado: string;
  logradouroNumero: string;
  bairro: string;
  municipioUf: string;
  cep: string;
  dataCarta: string; // YYYY-MM-DD
}

export function formatarDataExtenso(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.includes('T') ? dateStr.split('T')[0].split('-') : dateStr.split('-');
  if (parts.length === 3) {
    const ano = parts[0];
    const mesIdx = parseInt(parts[1], 10) - 1;
    const dia = parseInt(parts[2], 10);
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    if (mesIdx >= 0 && mesIdx < 12 && !isNaN(dia)) {
      return `${dia} de ${meses[mesIdx]} de ${ano}`;
    }
  }
  return dateStr;
}

export function limparCnpj(cnpj: string): string {
  return String(cnpj || '').replace(/\D/g, '');
}

export async function gerarCartaAnuenciaBlob(data: CartaAnuenciaData): Promise<Blob> {
  const dataExtenso = formatarDataExtenso(data.dataCarta || new Date().toISOString().slice(0, 10));

  const valorStr = typeof data.valorNominal === 'number'
    ? data.valorNominal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : String(data.valorNominal || 'R$ 0,00');

  // Constrói o texto do sacado
  const enderecoCompleto = [data.logradouroNumero, data.bairro].filter(Boolean).join(', ');

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 2.54 cm
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children: [
          // Título
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 600 },
            children: [
              new TextRun({
                text: 'CARTA DE ANUÊNCIA',
                bold: true,
                size: 28, // 14pt
                font: 'Calibri'
              })
            ]
          }),

          // Parágrafo Principal
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 280, after: 400 },
            children: [
              new TextRun({
                text: 'Pela presente, a empresa ',
                font: 'Calibri',
                size: 22
              }),
              new TextRun({
                text: 'LEPTA MULTSETORIAL FUNDO DE INVESTIMENTO EM DIREITOS CREDITÓRIOS, CNPJ 59.904.247/0001-85',
                bold: true,
                font: 'Calibri',
                size: 22
              }),
              new TextRun({
                text: ', representado por sua administradora ',
                font: 'Calibri',
                size: 22
              }),
              new TextRun({
                text: 'HEMERA DISTRIBUIDORA DE TITULOS E VALORES MOBILIARIOS LTDA.',
                bold: true,
                font: 'Calibri',
                size: 22
              }),
              new TextRun({
                text: ', instituição financeira devidamente autorizada para tanto, com sede à Avenida Água Verde, 1413, Loja 801, 8° andar, Água Verde, Curitiba/PR, CEP 80620-200, inscrita no CNPJ sob o n° 39.669.186/0001-01, declara que dá plena e total quitação ao(s) débito(s) havido(s) contra o sacado ',
                font: 'Calibri',
                size: 22
              }),
              new TextRun({
                text: data.nomeSacado || 'Sacado',
                bold: true,
                font: 'Calibri',
                size: 22
              }),
              new TextRun({
                text: `, sediada na ${enderecoCompleto || 'Endereço não informado'}, no município ${data.municipioUf || ''}, CEP:${data.cep || ''}, inscrita no CNPJ n° ${data.cnpjSacado || ''}, representados pelo(s) título(s) protestado(s):`,
                font: 'Calibri',
                size: 22
              })
            ]
          }),

          // Tabela de Títulos
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.CENTER,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tipo', bold: true, font: 'Calibri', size: 22 })] })],
                    shading: { fill: 'E2E8F0' }
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Número', bold: true, font: 'Calibri', size: 22 })] })],
                    shading: { fill: 'E2E8F0' }
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Vencimento', bold: true, font: 'Calibri', size: 22 })] })],
                    shading: { fill: 'E2E8F0' }
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Valor', bold: true, font: 'Calibri', size: 22 })] })],
                    shading: { fill: 'E2E8F0' }
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.tipoDocumento || 'DM', font: 'Calibri', size: 22 })] })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.numeroTitulo || '-', font: 'Calibri', size: 22 })] })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.dataVencimento || '-', font: 'Calibri', size: 22 })] })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: valorStr, font: 'Calibri', size: 22 })] })]
                  })
                ]
              })
            ]
          }),

          // Parágrafo Legal
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 400, line: 280, after: 600 },
            children: [
              new TextRun({
                text: 'Declara, ainda, que nada tem a opor ao cancelamento do(s) protesto(s) de tal(is) título(s), conforme os termos da Lei nº9.492 de 10 de setembro de 1997.',
                font: 'Calibri',
                size: 22
              })
            ]
          }),

          // Data
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 800 },
            children: [
              new TextRun({
                text: `Barueri/SP, ${dataExtenso}.`,
                font: 'Calibri',
                size: 22
              })
            ]
          }),

          // Linha de Assinatura
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '___________________________________________________________________________________',
                font: 'Calibri',
                size: 22
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100 },
            children: [
              new TextRun({
                text: 'LEPTA MULTSETORIAL FUNDO DE INVESTIMENTO EM DIREITOS CREDITÓRIOS CNPJ: 59.904.247/0001-85',
                bold: true,
                font: 'Calibri',
                size: 20
              })
            ]
          })
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}
