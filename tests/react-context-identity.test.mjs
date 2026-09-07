import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';

const require = createRequire(path.resolve(process.env.JARVIS_VITE_CHECKOUT || 'webaverse/app', 'package.json'));
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const patch = fs.readFileSync(new URL('../patches/0063-share-react-contexts-across-ui-entries.patch', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const source = patch.split('@@\n')[1].split('diff --git')[0].split('\n')
  .filter(line => line.startsWith('+')).map(line => line.slice(1)).join('\n')
  .replace("'react'", JSON.stringify(pathToFileURL(require.resolve('react')).href));
const dataUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const contextUrl = dataUrl(source);

test('versioned providers and unversioned consumers read the same app and identity contexts', async () => {
  const entry = version => import(dataUrl(`export {AppContext, JarvisIdentityContext} from ${JSON.stringify(contextUrl)}; // ${version}`));
  const provider = await entry('App.jsx?jarvis-runtime=69&jarvis-retry=0');
  const consumer = await entry('App.jsx');
  assert.equal(provider.AppContext, consumer.AppContext);
  assert.equal(provider.JarvisIdentityContext, consumer.JarvisIdentityContext);
  const state = {openedPanel: 'ChatPanel'};
  const app = {name: 'Jarvis'};
  function Child() {
    const value = React.useContext(consumer.AppContext);
    const identity = React.useContext(consumer.JarvisIdentityContext);
    assert.equal(value.state, state);
    assert.equal(value.app, app);
    assert.equal(identity.name, 'Player');
    return React.createElement('span', null, value.state.openedPanel);
  }
  const html = renderToStaticMarkup(React.createElement(provider.JarvisIdentityContext.Provider, {value: {name: 'Player'}},
    React.createElement(provider.AppContext.Provider, {value: {state, app}}, React.createElement(Child))));
  assert.equal(html, '<span>ChatPanel</span>');
});
