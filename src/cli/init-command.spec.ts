import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import rimraf from 'rimraf';

import { MockLogger } from '../../test/mock-logger';
import { temporaryFile, temporaryFiles } from '../../test/temporary-fs';

import { InitCommand } from './init-command';

describe('cli insert', () => {
  const logger = new MockLogger();
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), randomBytes(20).toString('hex'));
    mkdirSync(root);
  });

  afterEach(() => {
    rimraf.sync(root);
  });

  it('should instantiate', () => {
    // tslint:disable-next-line: no-unused-expression
    new InitCommand({});
  });

  it('should fail due to missing package.json', async () => {
    const command = new InitCommand({ directory: root }, logger);
    await expect(command.execute()).rejects
      .toThrow('This command must be executed in a directory with a package.json!');
  });

  it('should fail due to missing environment file', async () => {
    const command = new InitCommand({ directory: root }, logger);
    const file = join(root, 'package.json');
    await temporaryFile({ file, content: packageTemplate }, async () => {
      await expect(command.execute()).rejects.toBeInstanceOf(Error);
    });
  });

  it('should fail due to using both npm and yarn', async () => {
    const command = new InitCommand({ directory: root, npm: true, yarn: true }, logger);
    const file = join(root, 'package.json');
    await temporaryFile({ file, content: packageTemplate }, async () => {
      await expect(command.execute()).rejects.toBeInstanceOf(Error);
    });
  });

  it('should fail due to using both process-env and ng-env', async () => {
    const command = new InitCommand({ directory: root, processEnv: true, ngEnv: true }, logger);
    const file = join(root, 'package.json');
    await temporaryFile({ file, content: packageTemplate }, async () => {
      await expect(command.execute()).rejects.toBeInstanceOf(Error);
    });
  });

  it('should default to cwd', () => {
    const command = new InitCommand({}, logger);
    expect((command as any)._directory).toEqual(process.cwd());
  });

  it('should initialize correctly', async () => {
    for (const content of ['', environmentTemplate]) {
      const command = new InitCommand(
        { directory: root, environmentFile: 'environment.prod.ts' }, logger);
      const packageJsonPath = join(root, 'package.json');
      const environmentFilePath = join(root, 'environment.prod.ts');
      const [packageJson, environmentFile] = await temporaryFiles([
        { file: packageJsonPath, content: packageTemplate },
        { file: environmentFilePath, content },
      ], async () => await command.execute());

      expect(packageJson).toContain('"angular-server-side-configuration"');
      expect(environmentFile).toContain(`import 'angular-server-side-configuration/process';`);
    }
  }, 20000);

  it('should initialize correctly with yarn', async () => {
    const command = new InitCommand(
      { directory: root, environmentFile: 'environment.prod.ts', yarn: true }, logger);
    const packageJsonPath = join(root, 'package.json');
    const environmentFilePath = join(root, 'environment.prod.ts');
    const [packageJson, environmentFile] = await temporaryFiles([
      { file: packageJsonPath, content: packageTemplate },
      { file: environmentFilePath, content: '' },
    ], async () => await command.execute());

    expect(packageJson).toContain('"angular-server-side-configuration"');
    expect(environmentFile).toContain(`import 'angular-server-side-configuration/process';`);
  }, 20000);

  it('should initialize correctly with ng-env', async () => {
    for (const content of ['', environmentNgEnvTemplate]) {
      const command = new InitCommand(
        { directory: root, environmentFile: 'environment.prod.ts', ngEnv: true }, logger);
      const packageJsonPath = join(root, 'package.json');
      const environmentFilePath = join(root, 'environment.prod.ts');
      const [packageJson, environmentFile] = await temporaryFiles([
        { file: packageJsonPath, content: packageTemplate },
        { file: environmentFilePath, content },
      ], async () => await command.execute());

      expect(packageJson).toContain('"angular-server-side-configuration"');
      expect(environmentFile).toContain(`import { NG_ENV } from 'angular-server-side-configuration/ng-env';`);
    }
  }, 20000);
});

const packageTemplate = `
{
  "name": "test-project",
  "version": "1.1.0",
  "private": true
}`;

const environmentTemplate = `
import 'angular-server-side-configuration/process';

export const environment = {
  production: true
};
`;

const environmentNgEnvTemplate = `
import { NG_ENV } from 'angular-server-side-configuration/ng-env';

export const environment = {
  production: true
};
`;
