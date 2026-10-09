import fs from 'node:fs';
const dir='docs/cloudflare-deploy-20261008/';let code=fs.readFileSync(dir+'release.mjs','utf8');
code=code.replace("import fs from 'node:fs';","import fs from 'node:fs';\nimport {createRequire} from 'node:module';");
code=code.replace(/^const publicInputs=.*$/m,"const publicInputs=createRequire(import.meta.url)('../../node_modules/dotenv').parse(fs.readFileSync(path.join(prior.build,'.env.production.local')));\nif(Object.keys(publicInputs).some(k=>!k.startsWith('NEXT_PUBLIC_')))throw Error('Unexpected nonpublic build input');");fs.writeFileSync(dir+'release.mjs',code);
