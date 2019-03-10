import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { environmentProdContent, environmentProdNgEnvContent, temporaryFile } from '../../test/temporary-fs';
import { WrapAotCommand } from './wrap-aot-command';


describe('cli wrap-aot', () => {
  console.log = () => void 0;
  const root = join(__dirname, '..', '..', 'test', 'wrap-aot-command');
  const environmentFilePath = join(root, 'environment.prod.ts');

  it('should fail due to missing ng command', async () => {
    const command = new WrapAotCommand({ ngCommands: [], directory: root });
    await expect(command.execute()).rejects.toThrow('No command given to ngssc wrap-aot!');
  });

  it('should fail due to missing environment file', async () => {
    const command = new WrapAotCommand({ ngCommands: ['ng', 'build'], directory: root });
    await expect(command.execute()).rejects.toThrow(/^Given file does not exist/);
  });

  it('should fail due to using both process-env and ng-env', async () => {
    const command = new WrapAotCommand({ ngCommands: ['ng', 'build'], directory: root, processEnv: true, ngEnv: true });
    await expect(command.execute()).rejects.toBeInstanceOf(Error);
  });

  it('should resolve dist directory', async () => {
    const command = new WrapAotCommand({ ngCommands: ['ng', 'build'], directory: root, dist: 'dist' });
    await expect(command.execute()).rejects.toThrow(/^Given file does not exist/);
  });

  it('should tokenize environment file', async () => {
    await testReplacement();
  });

  it('should fail when typescript can\'t be loaded', async () => {
    class SpecCommand extends WrapAotCommand {
      async _loadTypescript(): Promise<any> {
        throw new Error('Cannot find module \'typescript\'');
      }
    }
    const command = new SpecCommand({
      directory: root, environmentFile: 'environment.prod.ts', ngCommands: ['ng', 'build'],
    });
    await temporaryFile({ file: environmentFilePath, content: environmentProdContent }, async () => {
      await expect(command.execute()).rejects.toThrow(
        'ngssc wrap-aot requires an installation of typescript!'
        + ' This is expected to be available in an angular project.');
    });
  });

  it('should work with ts 3.2', async () => {
    await testTypeScriptVersion('3.2.4');
  });

  it('should work with ts 3.1', async () => {
    await testTypeScriptVersion('3.1.6');
  });

  it('should work with ts 3.0', async () => {
    await testTypeScriptVersion('3.0.3');
  });

  it('should work with ts 2.9', async () => {
    await testTypeScriptVersion('2.9.2');
  });

  it('should work with ts 2.8', async () => {
    await testTypeScriptVersion('2.8.4');
  });

  it('should work with ts 2.7', async () => {
    await testTypeScriptVersion('2.7.2');
  });

  it('should spawn given command', async () => {
    const command = new WrapAotCommand({
      directory: root,
      environmentFile: 'environment.prod.ts',
      ngCommands: ['npm', '-v'],
    });
    await temporaryFile({ file: environmentFilePath, content: environmentProdContent }, async () => {
      await command.execute();
    });
  });

  it('should execute with invalid command', async () => {
    const command = new WrapAotCommand({
      directory: root,
      environmentFile: 'environment.prod.ts',
      ngCommands: ['thisisaninvalidcommandandshouldnotcomplete', 'test'],
    });
    await temporaryFile({ file: environmentFilePath, content: environmentProdContent }, async () => {
      await command.execute();
    });
  });

  async function testTypeScriptVersion(version: string) {
    // tslint:disable-next-line
    await testReplacement(class extends WrapAotCommand {
      async _loadTypescript(): Promise<any> {
        return require(`../../test/wrap-aot-command/ts-versions/typescript-${version}/typescript`);
      }
    });
  }

  async function testReplacement(commandClass: typeof WrapAotCommand = WrapAotCommand) {
    const distFilePath = join(root, 'dist', 'tmp.js');
    let tokenizedContent = '';
    // tslint:disable-next-line
    class SpecCommand extends commandClass {
      async _spawnCommand() {
        tokenizedContent = readFileSync(environmentFilePath, 'utf8');
        const distFileContent = (tokenizedContent.match(/"ngssc-token-\d+-\d+"/g) || [])
          .map((m, i) => `var value${i} = ${m};`)
          .join('\n');
        writeFileSync(distFilePath, distFileContent, 'utf8');
      }
    }

    const processEnv = { config: {}, environmentContent: environmentProdContent, match: 'process.' };
    const ngEnv = { config: { ngEnv: true }, environmentContent: environmentProdNgEnvContent, match: 'NG_ENV.' };

    for (const env of [processEnv, ngEnv]) {
      const command = new SpecCommand({
        directory: root, environmentFile: 'environment.prod.ts', ngCommands: ['ng', 'build'], ...env.config
      });

      const finalContent = await temporaryFile(
        { file: environmentFilePath, content: env.environmentContent },
        async () => {
          await command.execute();
        });
      const finalDistContent = readFileSync(distFilePath, 'utf8');
      unlinkSync(distFilePath);

      expect(tokenizedContent).toContain('ngssc-token-');
      expect((tokenizedContent.match(new RegExp(env.match.replace('.', '\\.'), 'g')) || []).length).toEqual(7);
      expect(finalContent).toEqual(env.environmentContent);
      expect(finalDistContent).toContain(env.match);
    }
  }
});
