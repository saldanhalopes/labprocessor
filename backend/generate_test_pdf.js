import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function createTestPdf() {
  console.log('--- Generating Mock Pharmaceutical Monograph ---');
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBoldFont = await pdfDoc.embedFont(StandardFonts.TimesBold);
  
  const page = pdfDoc.addPage([600, 800]);
  const { width, height } = page.getSize();
  const fontSize = 12;

  // Header
  page.drawText('METODO ANALITICO: CONTROLE DE QUALIDADE', {
    x: 50,
    y: height - 50,
    size: 16,
    font: timesBoldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText('PRODUTO: PARACETAMOL 500mg COMPRIMIDOS', {
    x: 50,
    y: height - 80,
    size: 14,
    font: timesBoldFont,
  });

  // Product Data Table
  let y = height - 120;
  page.drawText('DADOS DO PRODUTO:', { x: 50, y, size: 12, font: timesBoldFont });
  y -= 20;
  page.drawText('Codigo: COD-PAR-001', { x: 50, y, size: 10, font: timesRomanFont });
  y -= 15;
  page.drawText('Forma Farmaceutica: Comprimido', { x: 50, y, size: 10, font: timesRomanFont });
  y -= 15;
  page.drawText('Principio Ativo: Paracetamol (Acetaminofeno)', { x: 50, y, size: 10, font: timesRomanFont });
  y -= 15;
  page.drawText('Composicao: Paracetamol, Amido, PVP K30, Estearato de Magnesio.', { x: 50, y, size: 10, font: timesRomanFont });
  y -= 15;
  page.drawText('Tamanho do Lote: 500.000 comprimidos', { x: 50, y, size: 10, font: timesRomanFont });

  // Tests Table
  y -= 40;
  page.drawText('ESPECIFICACOES E TESTES:', { x: 50, y, size: 12, font: timesBoldFont });
  y -= 25;
  
  const tests = [
    { name: 'DISSOLUCAO', technique: 'HPLC', prep: '30 min', run: '120 min', calc: '15 min' },
    { name: 'TEOR (ASSAY)', technique: 'HPLC', prep: '45 min', run: '90 min', calc: '20 min' },
    { name: 'UNIFORMIDADE DE CONTEUDO', technique: 'HPLC', prep: '60 min', run: '180 min', calc: '30 min' },
    { name: 'CONTAGEM MICROBIANA TOTAL', technique: 'CULTURA', prep: '40 min', run: '0 min', calc: '10 min', incubation: '5 dias' }
  ];

  for (const t of tests) {
    page.drawText(`- Teste: ${t.name} (${t.technique})`, { x: 50, y, size: 10, font: timesBoldFont });
    y -= 15;
    page.drawText(`  Preparo: ${t.prep}, Corrida: ${t.run}, Calculos: ${t.calc}${t.incubation ? ', Incubacao: ' + t.incubation : ''}`, { x: 60, y, size: 9, font: timesRomanFont });
    y -= 20;
  }

  // Reagents
  y -= 20;
  page.drawText('REAGENTES E SOLUCOES:', { x: 50, y, size: 12, font: timesBoldFont });
  y -= 20;
  page.drawText('- Metanol (Grau HPLC)', { x: 50, y, size: 10, font: timesRomanFont });
  y -= 15;
  page.drawText('- Acido Cloridrico 0.1N', { x: 50, y, size: 10, font: timesRomanFont });
  y -= 15;
  page.drawText('- Agua Ultrapura (q.s.p 1000 mL)', { x: 50, y, size: 10, font: timesRomanFont });

  // Equipments
  y -= 30;
  page.drawText('EQUIPAMENTOS:', { x: 50, y, size: 12, font: timesBoldFont });
  y -= 20;
  page.drawText('- Cromatografo HPLC Agilent 1260 con Columna C18', { x: 50, y, size: 10, font: timesRomanFont });
  y -= 15;
  page.drawText('- Dissolutor USP Apparato 2 (Pas)', { x: 50, y, size: 10, font: timesRomanFont });

  // Final section
  y -= 40;
  page.drawText('Este documento e um teste para verificacao da configuracao do LabProcessor.', { x: 50, y, size: 8, font: timesRomanFont, color: rgb(0.5, 0.5, 0.5) });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('./tmp/test_monograph.pdf', pdfBytes);
  console.log('Successfully generated: ./tmp/test_monograph.pdf');
}

createTestPdf().catch(console.error);
