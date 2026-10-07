import { promises as fs } from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

// Cualquier import del módulo de sesión o del cliente autenticado, sea cual sea la ruta relativa
const FORBIDDEN_IMPORTS = [
  /from\s+['"][^'"]*auth\/session['"]/,
  /from\s+['"][^'"]*auth\/usePrincipal['"]/,
  /from\s+['"][^'"]*api\/http['"]/,
  /from\s+['"]\.\/http['"]/,
  /from\s+['"][^'"]*api\/publicCampaigns['"]/,
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

    // `import type` desaparece al compilar: no arrastra código de cliente al servidor
    const runtimeImports = content.split('\n').filter((l) => !/^\s*import\s+type\b/.test(l)).join('\n');
    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (forbidden.test(runtimeImports)) {
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

checkServerImports().catch((e) => { console.error(e); process.exit(1); });
