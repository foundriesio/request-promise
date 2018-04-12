const assert = require('assert');

const agent = require('../lib/agent');
const {RequestAgentError} = require('../lib/errors');

describe('Test the RequestAgent module:', () => {
    process.env.NODE_ENV = 'test';

    it('should create a new RequestAgent with HTTP', async () => {
        const agt = await agent.create('http://localhost');

        assert.ok(agt instanceof agent.RequestAgent);
    });

    it('should create a new RequestAgent with HTTPS', async () => {
        const agt = await agent.create('https://localhost');

        assert.ok(agt instanceof agent.RequestAgent);
    });

    it('should create a single http.Agent', async () => {
        const agt0 = await agent.create('http://localhost');
        const agt1 = await agent.create('http://localhost/foo/bar');

        assert.deepStrictEqual(agt0.httpOptions.agent, agt1.httpOptions.agent);
    });

    it('should create a single https.Agent', async () => {
        const agt0 = await agent.create('https://localhost');
        const agt1 = await agent.create('https://example.net/foo/bar');

        assert.deepStrictEqual(agt0.httpOptions.agent, agt1.httpOptions.agent);
    });

    it('should create two http.Agents (same host, different port)', async () => {
        const agt0 = await agent.create('http://localhost');
        const agt1 = await agent.create('https://localhost/foo/bar');

        assert.notDeepStrictEqual(agt0.httpOptions.agent, agt1.httpOptions.agent);
    });

    it('should create the correct HTTP options', async () => {
        const headers = {
            foo: 'bar',
            'X-Foo': 'baz'
        };
        const agt = await agent.create(
            'https://localhost:5555/foo/bar',
            {method: 'FOO', headers: headers});

        const expectedHeaders = {
            'Accept-Encoding': 'gzip, deflate, identity',
            'foo': 'bar',
            'X-Foo': 'baz'
        };

        assert.equal(agt.httpOptions.port, 5555);
        assert.equal(agt.httpOptions.path, '/foo/bar');
        assert.equal(agt.httpOptions.hostname, 'localhost');
        assert.equal(agt.httpOptions.protocol, 'https:');
        assert.equal(agt.httpOptions.method, 'FOO');

        assert.deepStrictEqual(agt.httpOptions.headers, expectedHeaders);
    });

    it('should create the correct Agent options', async () => {
        const agt = await agent.create(
            'https://localhost:5555/foo/bar', {secureProtocol: 'FOO'});

        assert.ok(agt instanceof agent.RequestAgent);
        assert.equal(agt.agentOptions.maxSockets, 2048);
        assert.equal(agt.agentOptions.secureProtocol, 'FOO');
    });

    it('should normalize the URL path', async () => {
        const agt = await agent.create('https://localhost/foo//bar///baz/');

        assert.equal(agt.httpOptions.path, '/foo/bar/baz/');
    });

    it('should create two URL objects', async () => {
        const { URL } = require('url');
        const agt = await agent.create('https://localhost/foo/');

        const [oldUrl, newUrl] = agt.toURLs(
            'https://localhost/foo/', 'http://example.net/foo');

        assert.ok(oldUrl instanceof URL);
        assert.ok(newUrl instanceof URL);
    });

    it('calling update with new domain should update the agent', async () => {
        const agt = await agent.create('https://localhost/foo/');

        assert.ok(agt instanceof agent.RequestAgent);

        const oldHttpOpts = Object.assign({}, agt.httpOptions);

        const [oldUrl, newUrl] = agt.toURLs(
            'https://localhost/foo/', 'http://example.net/foo');

        await agt.update(oldUrl, newUrl);

        assert.notDeepStrictEqual(oldHttpOpts, agt.httpOptions);
        assert.notDeepStrictEqual(oldHttpOpts.agent, agt.httpOptions.agent);
    });

    it('calling update with same domain should not update the agent', async () => {
        const agt = await agent.create('https://localhost/foo/');

        assert.ok(agt instanceof agent.RequestAgent);

        const oldHttpOpts = Object.assign({}, agt.httpOptions);

        const [oldUrl, newUrl] = agt.toURLs(
            'https://localhost/foo/', 'https://localhost/bar/');

        await agt.update(oldUrl, newUrl);

        // Path is different.
        assert.notDeepStrictEqual(oldHttpOpts, agt.httpOptions);
        assert.deepStrictEqual(oldHttpOpts.agent, agt.httpOptions.agent);
    });


    it('should throw an error when options is not an Object', async () => {
        await agent.create('http://localhost', []).catch((err) => {
            assert.ok(err instanceof RequestAgentError);
        });

        await agent.create('http://localhost', [1, 2]).catch((err) => {
            assert.ok(err instanceof RequestAgentError);
        });

        await agent.create('http://localhost', 1).catch((err) => {
            assert.ok(err instanceof RequestAgentError);
        });

        await agent.create('http://localhost', 'options').catch((err) => {
            assert.ok(err instanceof RequestAgentError);
        });
    });

    it('should throw an error when the protocol is not supported', async () => {
        await agent.create('ftp://localhost').catch((err) => {
            assert.ok(err instanceof RequestAgentError);
        });

        await agent.create('ssh://localhost').catch((err) => {
            assert.ok(err instanceof RequestAgentError);
        });

        await agent.create('irc://localhost').catch((err) => {
            assert.ok(err instanceof RequestAgentError);
        });

        await agent.create('foo://localhost').catch((err) => {
            assert.ok(err instanceof RequestAgentError);
        });
    });
});
