#!/usr/bin/env node

/**
 * WorksAuto Architecture Integrity Verification Linter
 * Enforces Clean Architecture & SOLID Boundaries in CI/CD Pipeline
 * 
 * Spec Alignment:
 * - Section 4: Backend Architecture & Dependency Inversion (Presentation -> Application -> Domain)
 * - Section 5: Backend Coding Rules (Domain purity, Controller boundaries, DTO separation)
 * - Section 57: Definition of Done (Clean Architecture enforcement before merging)
 * - ADR-002: Module Migration Strategy (DDD vs Lightweight module boundaries)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const API_SRC_DIR = fs.existsSync(path.join(ROOT_DIR, 'src'))
  ? path.join(ROOT_DIR, 'src')
  : path.join(ROOT_DIR, 'worksauto-api', 'src');

// DDD Modules that strictly enforce Presentation -> Application -> Domain separation
const DDD_MODULES = ['work-orders', 'inventory', 'invoices', 'appointments', 'customers', 'vehicles', 'current-accounts'];

// Prohibited imports in domain layer (Spec Md. 4: Domain katmanı altyapıyı ve çerçeveyi bilmemelidir)
const PROHIBITED_DOMAIN_IMPORTS = [
  { pattern: /from\s+['"]@nestjs\//, label: 'NestJS framework (@nestjs/*)' },
  { pattern: /from\s+['"]@prisma\/client['"]/, label: 'Prisma Client (@prisma/client)' },
  { pattern: /from\s+['"]ioredis['"]/, label: 'Redis driver (ioredis)' },
  { pattern: /from\s+['"]bullmq['"]/, label: 'Queue driver (bullmq)' },
  { pattern: /from\s+['"]express['"]/, label: 'Express HTTP server' },
  { pattern: /from\s+['"]supertest['"]/, label: 'Supertest HTTP client' },
  { pattern: /from\s+['"]axios['"]/, label: 'Axios HTTP client' },
  { pattern: /from\s+['"]\.\..*\/infrastructure\//, label: 'Infrastructure layer (Reverse dependency)' },
  { pattern: /from\s+['"]\.\..*\/presentation\//, label: 'Presentation layer (Reverse dependency)' },
  { pattern: /from\s+['"]\.\..*\/application\//, label: 'Application layer (Reverse dependency)' },
];

// Prohibited imports in presentation/controller layer (Spec Md. 5.1: Controller yalnızca Use Case çağırmalıdır)
const PROHIBITED_PRESENTATION_IMPORTS = [
  { pattern: /from\s+['"].*prisma\.service['"]/, label: 'Direct PrismaService dependency (Must use UseCase or Service)' },
];

let totalFilesChecked = 0;
const violations = [];

/**
 * Recursively find all typescript files
 */
function walkSync(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        walkSync(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

/**
 * Check a single TypeScript file against architecture boundary rules
 */
function checkFile(filePath) {
  totalFilesChecked++;
  const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');

  // Rule 3: Use case spec matching check
  if (filePath.endsWith('.use-case.ts')) {
    const specPath = filePath.replace(/\.use-case\.ts$/, '.use-case.spec.ts');
    if (!fs.existsSync(specPath)) {
      violations.push({
        file: relativePath,
        line: 1,
        code: path.basename(filePath),
        rule: `[Definition of Done] Missing Spec Violation: Every use case (${path.basename(filePath)}) must have a corresponding *.use-case.spec.ts file for CI validation.`,
      });
    }
  }

  // Skip analyzing content of test files
  if (filePath.endsWith('.spec.ts')) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const isDomainLayer = relativePath.includes('/domain/');
  const isDddModule = DDD_MODULES.some((mod) => relativePath.includes(`/modules/${mod}/`));
  const isPresentationLayer = (relativePath.includes('/presentation/') || relativePath.endsWith('.controller.ts')) && isDddModule;
  const isApplicationLayer = relativePath.includes('/application/');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return; // Skip comments
    }

    // 1. Check Domain Layer Purity across all DDD modules (Md. 4)
    if (isDomainLayer) {
      for (const rule of PROHIBITED_DOMAIN_IMPORTS) {
        if (rule.pattern.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            code: trimmed,
            rule: `[Spec Md. 4] Domain Purity Violation: Prohibited dependency on ${rule.label}. Domain must be pure TypeScript.`,
          });
        }
      }
    }

    // 2. Check Presentation Layer Separation for DDD modules (Md. 5.1 & ADR-002)
    if (isPresentationLayer) {
      for (const rule of PROHIBITED_PRESENTATION_IMPORTS) {
        if (rule.pattern.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            code: trimmed,
            rule: `[Spec Md. 5.1] Controller Responsibility Violation: ${rule.label}. In DDD modules, controllers must only call Use Cases.`,
          });
        }
      }
    }

    // 3. Check Application Layer Direction (Application cannot import Infrastructure directly)
    if (isApplicationLayer) {
      if (/from\s+['"]\.\..*\/infrastructure\//.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          code: trimmed,
          rule: `[Spec Md. 4] Clean Architecture Dependency Rule: Application layer cannot import Infrastructure layer directly (Dependency Inversion violation).`,
        });
      }
    }
  });
}

function run() {
  console.log('🏛️  WorksAuto Clean Architecture & Layer Boundary Verification');
  console.log(`📂 Scanning API source files in: ${path.relative(ROOT_DIR, API_SRC_DIR)}\n`);

  const files = walkSync(API_SRC_DIR);
  files.forEach(checkFile);

  console.log(`📊 Scanned ${totalFilesChecked} files.`);

  if (violations.length === 0) {
    console.log('\n✅ [PASS] All architectural integrity checks passed! No layer boundary violations detected.\n');
    process.exit(0);
  } else {
    console.error(`\n❌ [FAIL] Found ${violations.length} architectural boundary violation(s):\n`);
    violations.forEach((v, i) => {
      console.error(`  ${i + 1}. ${v.file}:${v.line}`);
      console.error(`     Issue: ${v.rule}`);
      console.error(`     Code : ${v.code}\n`);
    });
    console.error('💡 Please review docs/ADR-002-module-migration-strategy.md to align with Clean Architecture.\n');
    process.exit(1);
  }
}

run();
