const assert = require('assert');

const agent = require('../lib/agent');
const {RequestAgentError} = require('../lib/errors');

describe('Test the RequestAgent module:', () => {
    process.env.NODE_ENV = 'test';

    it('should create a new RequestAgent with HTTP', () => {
        const agt = agent.create('http://localhost');

        assert.ok(agt instanceof agent.RequestAgent);
    });

    it('should create a new RequestAgent with HTTPS', () => {
        const agt = agent.create('https://localhost');

        assert.ok(agt instanceof agent.RequestAgent);
    });

    it('should create a single http.Agent', () => {
        const agt0 = agent.create('http://localhost');
        const agt1 = agent.create('http://localhost/foo/bar');

        assert.ok(agt0.httpOptions.agent === agt1.httpOptions.agent);
    });

    it('should create two http.Agents (same host, different port)', () => {
        const agt0 = agent.create('http://localhost');
        const agt1 = agent.create('https://localhost/foo/bar');

        assert.ok(agt0.httpOptions.agent !== agt1.httpOptions.agent);
    });

    it('should create two http.Agents (different host, same port)', () => {
        const agt0 = agent.create('https://localhost');
        const agt1 = agent.create('https://example.net/foo/bar');

        assert.ok(agt0.httpOptions.agent !== agt1.httpOptions.agent);
    });

    it('should create the correct HTTP options', () => {
        const headers = {
            foo: 'bar',
            'X-Foo': 'baz'
        };
        const agt = agent.create(
            'https://localhost:5555/foo/bar', {method: 'FOO', headers: headers});

        const expectedHeaders = {
            'Accept-Encoding': 'gzip, deflate, identity',
            'foo': 'bar',
            'X-Foo': 'baz'
        };

        assert.equal(agt.httpOptions.port, 5555);
        assert.equal(agt.httpOptions.path, '/foo/bar');
        assert.equal(agt.httpOptions.host, 'localhost');
        assert.equal(agt.httpOptions.protocol, 'https:');
        assert.equal(agt.httpOptions.method, 'FOO');

        assert.deepStrictEqual(agt.httpOptions.headers, expectedHeaders);
    });

    it('should create the correct Agent options', () => {
        const agt = agent.create('https://localhost:5555/foo/bar', {secureProtocol: 'FOO'});

        assert.ok(agt instanceof agent.RequestAgent);
        assert.equal(agt.agentOptions.maxSockets, 2048);
        assert.equal(agt.agentOptions.secureProtocol, 'FOO');
    });

    it('should normalize the URL path', () => {
        const agt = agent.create('https://localhost/foo//bar///baz/');

        assert.equal(agt.httpOptions.path, '/foo/bar/baz/');
    });

    it('calling update with new domain should update the agent', () => {
        const agt = agent.create('https://localhost/foo/');

        assert.ok(agt instanceof agent.RequestAgent);

        const oldHttpOpts = Object.assign({}, agt.httpOptions);

        agt.update('https://localhost/foo/', 'http://example.net/foo');

        assert.notDeepStrictEqual(oldHttpOpts, agt.httpOptions);
        assert.notDeepStrictEqual(oldHttpOpts.agent, agt.httpOptions.agent);
    });

    it('calling update with same domain should not update the agent', () => {
        const agt = agent.create('https://localhost/foo/');

        assert.ok(agt instanceof agent.RequestAgent);

        const oldHttpOpts = Object.assign({}, agt.httpOptions);

        agt.update('https://localhost/foo/', 'https://localhost/bar/');

        // Path is different.
        assert.notDeepStrictEqual(oldHttpOpts, agt.httpOptions);
        assert.deepStrictEqual(oldHttpOpts.agent, agt.httpOptions.agent);
    });

    it('should throw an error when the protocol is not supported', () => {
        assert.throws(() => {
            agent.create('ftp://localhost');
        }, RequestAgentError);

        assert.throws(() => {
            agent.create('ssh://localhost');
        }, RequestAgentError);

        assert.throws(() => {
            agent.create('irc://localhost');
        }, RequestAgentError);

        assert.throws(() => {
            agent.create('foo://localhost');
        }, RequestAgentError);

        assert.throws(() => {
            agent.create('gopher://localhost');
        }, RequestAgentError);
    });
});
