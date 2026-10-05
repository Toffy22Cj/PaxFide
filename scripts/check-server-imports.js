import { promises as fs } from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

const FORBIDDEN_IMPORTS = [
  '@/lib/auth/session',
  '../lib/auth/session',
  'src/lib/auth/session'
];

async function getFiles(dir, fileList = []) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if ((await fs.stat(filePath)).isDirectory()) {
      await getFiles(filePath, fileList);
    } else {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

async function checkServerImports() {
  const files = await getFiles(SRC_DIR);
  let hasErrors = false;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    
    // Si tiene "use client" o 'use client', es de cliente
    if (content.includes('"use client"') || content.includes("'use client'")) {
      continue;
    }

    // Si es un archivo de test, ignorar
    if (file.includes('.test.') || file.includes('__tests__')) {
      continue;
    }

    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (content.includes(forbidden)) {
        console.error(`❌ ERROR: Archivo de servidor (${path.relative(process.cwd(), file)}) importa un módulo prohibido: ${forbidden}`);
        hasErrors = true;
      }
    }
  }

  if (hasErrors) {
    console.error('Chequeo estático fallido. El código de servidor no debe importar la sesión.');
    process.exit(1);
  } else {
    console.log('✅ Chequeo estático de imports en servidor: OK.');
  }
}

checkServerImports().catch(console.error);
