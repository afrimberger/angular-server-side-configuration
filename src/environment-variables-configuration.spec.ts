import { expect } from 'chai';
import { join } from 'path';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';

import { EnvironmentVariablesConfiguration } from './environment-variables-configuration';

describe('EnvironmentVariablesConfiguration', () => {
  const root = join(__dirname, '..', 'testing', 'environment-variables-configuration');

  it('should find TEST and TEST2', () => {
    const envVariables = EnvironmentVariablesConfiguration.searchEnvironmentVariables(root);
    expect(envVariables.variables).eql(['TEST', 'TEST2']);
  });

  it('should populate variables from process.env', () => {
    const expected = {
      TEST: 'test',
      TEST2: null,
    };
    process.env.TEST = expected.TEST;
    const envVariables = new EnvironmentVariablesConfiguration(Object.keys(expected));
    expect(envVariables.populateVariables()).eql(expected);
  });

  it('should apply the environment variables without modifying the file', async () => {
    const file = join(root, 'index.html');
    const envVariables = new EnvironmentVariablesConfiguration(['TEST', 'TEST2']);
    const content = await temporaryFile(file, async () => {
      const appliedContent = await envVariables.apply(file);
      expect(appliedContent).to.contain(envVariables.generateIIFE());
    });
    expect(content).not.to.contain(envVariables.generateIIFE());
  });

  it('should insert the environment variables into the file', async () => {
    const file = join(root, 'index.html');
    const envVariables = new EnvironmentVariablesConfiguration(['TEST', 'TEST2']);
    const content = await temporaryFile(file, async () => {
      await envVariables.insertAndSave(file);
    });
    expect(content).to.contain(envVariables.generateIIFE());
  });

  it('should insert the environment variables into all files', async () => {
    const files = ['index.html', join('de', 'index.html'), join('en', 'index.html')]
      .map(f => join(root, f));
    const envVariables = new EnvironmentVariablesConfiguration(['TEST', 'TEST2']);
    const contents = await temporaryFiles(files, async () => {
      await envVariables.insertAndSaveRecursively(root);
    });
    contents.forEach(c => expect(c).to.contain(envVariables.generateIIFE()));
  });
});

const template = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Test</title>
  <base href="/">

  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
<link rel="stylesheet" href="styles.34c57ab7888ec1573f9c.css"><!--CONFIG--></head>
<body>
  <aria-root></aria-root>
<script type="text/javascript" src="runtime.a66f828dca56eeb90e02.js"></script>
<script type="text/javascript" src="polyfills.b55409616db62255773a.js"></script>
<script type="text/javascript" src="main.9f14237bc2ddea0bb62d.js"></script></body>
</html>
`;

async function temporaryFile(file: string, action: () => Promise<any>): Promise<string> {
  const contents = await temporaryFiles([file], action);
  return contents[0];
}

async function temporaryFiles(files: string[], action: () => Promise<any>): Promise<string[]> {
  files.forEach(f => writeFileSync(f, template, 'utf8'));
  await action();
  const contents = files.map(f => readFileSync(f, 'utf8'));
  files.forEach(f => unlinkSync(f));
  return contents;
}