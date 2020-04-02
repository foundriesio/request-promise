const assert = require('assert');

const agent = require('../lib/agent');
const {RequestAgentError} = require('../lib/errors');

describe('Test the RequestAgent module:', () => {
    process.env.NODE_ENV = 'test';

    it('should create a new RequestAgent with HTTP', function(done) {
        const agt = agent.create('http://localhost');
        assert.ok(agt instanceof agent.RequestAgent);

        done();
    });

    it('should create a new RequestAgent with HTTPS', function(done) {
        const agt = agent.create('https://localhost');

        assert.ok(agt instanceof agent.RequestAgent);

        done();
    });

    it('should create a single http.Agent', function(done) {
        const agt0 = agent.create('http://localhost');
        const agt1 = agent.create('http://localhost/foo/bar');

        assert.deepStrictEqual(agt0.httpOptions.agent, agt1.httpOptions.agent);

        done();
    });

    it('should create a single https.Agent', function(done) {
        const agt0 = agent.create('https://localhost');
        const agt1 = agent.create('https://example.net/foo/bar');

        assert.deepStrictEqual(agt0.httpOptions.agent, agt1.httpOptions.agent);

        done();
    });

    it('should create two http.Agents (same host, different port)', function(done) {
        const agt0 = agent.create('http://localhost');
        const agt1 = agent.create('https://localhost/foo/bar');

        assert.notDeepStrictEqual(
            agt0.httpOptions.agent, agt1.httpOptions.agent);

        done();
    });

    it('should create the correct HTTP options', function(done) {
        const headers = {
            foo: 'bar',
            'X-Foo': 'baz'
        };
        const agt = agent.create(
            'https://localhost:5555/foo/bar',
            {method: 'FOO', headers: headers});

        const expectedHeaders = {
            'Accept-Encoding': 'gzip, deflate, identity',
            'foo': 'bar',
            'X-Foo': 'baz'
        };

        assert.strictEqual(agt.httpOptions.port, 5555);
        assert.strictEqual(agt.httpOptions.path, '/foo/bar');
        assert.strictEqual(agt.httpOptions.hostname, 'localhost');
        assert.strictEqual(agt.httpOptions.protocol, 'https:');
        assert.strictEqual(agt.httpOptions.method, 'FOO');

        assert.deepStrictEqual(agt.httpOptions.headers, expectedHeaders);

        done();
    });

    it('should create the correct Agent options', function(done) {
        const agt = agent.create(
            'https://localhost:5555/foo/bar', {secureProtocol: 'FOO'});

        assert.ok(agt instanceof agent.RequestAgent);
        assert.strictEqual(agt.agentOptions.maxSockets, 2048);
        assert.strictEqual(agt.agentOptions.secureProtocol, 'FOO');

        done();
    });

    it('should normalize the URL path', function(done) {
        const agt = agent.create('https://localhost/foo//bar///baz/');

        assert.strictEqual(agt.httpOptions.path, '/foo/bar/baz/');

        done();
    });

    it('should create two URL objects', function(done) {
        const { URL } = require('url');
        const agt = agent.create('https://localhost/foo/');

        const [oldUrl, newUrl] = agt.toURLs(
            'https://localhost/foo/', 'http://example.net/foo');

        assert.ok(oldUrl instanceof URL);
        assert.ok(newUrl instanceof URL);

        done();
    });

    it('calling update with new domain should update the agent', function(done) {
        const agt = agent.create('https://localhost/foo/');

        assert.ok(agt instanceof agent.RequestAgent);

        const oldHttpOpts = Object.assign({}, agt.httpOptions);

        const [oldUrl, newUrl] = agt.toURLs(
            'https://localhost/foo/', 'http://example.net/foo');

        agt.update(oldUrl, newUrl);

        assert.notDeepStrictEqual(oldHttpOpts, agt.httpOptions);
        assert.notDeepStrictEqual(oldHttpOpts.agent, agt.httpOptions.agent);

        done();
    });

    it('calling update with same domain should not update the agent', function(done) {
        const agt = agent.create('https://localhost/foo/');

        assert.ok(agt instanceof agent.RequestAgent);

        const oldHttpOpts = Object.assign({}, agt.httpOptions);

        const [oldUrl, newUrl] = agt.toURLs(
            'https://localhost/foo/', 'https://localhost/bar/');

        agt.update(oldUrl, newUrl);

        // Path is different.
        assert.notDeepStrictEqual(oldHttpOpts, agt.httpOptions);
        assert.deepStrictEqual(oldHttpOpts.agent, agt.httpOptions.agent);

        done();
    });


    it('should throw an error when options is not an Object', function(done) {
        assert.throws(() => {
            agent.create('http://localhost', []);
        }, RequestAgentError);

        assert.throws(() => {
            agent.create('http://localhost', [1, 2]);
        }, RequestAgentError);

        assert.throws(() => {
            agent.create('http://localhost', 1);
        }, RequestAgentError);

        assert.throws(() => {
            agent.create('http://localhost', 'options');
        }, RequestAgentError);

        done();
    });

    it('should throw an error when the protocol is not supported', function (done) {
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

        done();
    });
});
