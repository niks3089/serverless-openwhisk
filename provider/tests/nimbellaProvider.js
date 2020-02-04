'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const openwhisk = require('openwhisk');
const chaiAsPromised = require('chai-as-promised');
const BbPromise = require('bluebird');

require('chai').use(chaiAsPromised);

const NimbellaProvider = require('../nimbellaProvider');
const Credentials = require('../credentials');
const CliTokenManager = require('../cliTokenManager.js');

describe('NimbellaProvider', () => {
  let nimbellaProvider;
  let serverless;
  let sandbox;

  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const CLI = function () { this.log = function () {};};
    const serverless = {setProvider: () => {}, config: () => {}, pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => ({}), provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};
    nimbellaProvider = new NimbellaProvider(serverless, options);
    nimbellaProvider.serverless.cli = new serverless.classes.CLI();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#getProviderName()', () => {
    it('should return the provider name', () => {
      expect(NimbellaProvider.getProviderName()).to.equal('openwhisk');
    });
  });

  describe('#constructor()', () => {
    it('should set Serverless instance', () => {
      expect(typeof nimbellaProvider.serverless).to.not.equal('undefined');
    });

    it('should set OpenWhisk instance', () => {
      expect(typeof nimbellaProvider.sdk).to.not.equal('undefined');
    });

    it('should set the provider property', () => {
      expect(nimbellaProvider.provider).to.equal(nimbellaProvider);
    });
  });

  describe('#client()', () => {
    it('should return pre-configured openwhisk client', () => {
      nimbellaProvider._client = null
      const creds = {apihost: 'some_api', auth: 'user:pass'}
      sandbox.stub(nimbellaProvider, "props").returns(BbPromise.resolve(creds))
      return nimbellaProvider.client().then(client => {
        expect(client.actions.client.options).to.be.deep.equal({apigwToken: undefined, apigwSpaceGuid: undefined, namespace: undefined, apiKey: creds.auth, ignoreCerts: false, apiVersion: 'v1', cert: undefined, key: undefined, api: `https://${creds.apihost}/api/v1/`, authHandler: undefined, noUserAgent: undefined})
        expect(typeof nimbellaProvider._client).to.not.equal('undefined');
      })
    })

    it('should allow ignore_certs options for openwhisk client', () => {
      nimbellaProvider._client = null
      const creds = {apihost: 'some_api', auth: 'user:pass'}
      sandbox.stub(nimbellaProvider, "props").returns(BbPromise.resolve(creds))
      nimbellaProvider.serverless.service.provider.ignore_certs = true
      return nimbellaProvider.client().then(client => {
        expect(client.actions.client.options).to.be.deep.equal({apigwToken: undefined, apigwSpaceGuid: undefined, namespace: undefined, apiKey: creds.auth, ignoreCerts: true, apiVersion: 'v1', cert: undefined, key: undefined, api: `https://${creds.apihost}/api/v1/`, authHandler: undefined, noUserAgent: undefined})
        expect(typeof nimbellaProvider._client).to.not.equal('undefined');
      })
    })

    it('should allow apigw_access_token option for openwhisk client', () => {
      nimbellaProvider._client = null
      const creds = {apihost: 'some_api', auth: 'user:pass', apigw_access_token: 'token'}
      sandbox.stub(nimbellaProvider, "props").returns(BbPromise.resolve(creds))
      return nimbellaProvider.client().then(client => {
        expect(client.actions.client.options).to.be.deep.equal({apigwToken: 'token', apigwSpaceGuid: 'user', namespace: undefined, apiKey: creds.auth, ignoreCerts: false, apiVersion: 'v1', cert: undefined, key: undefined, api: `https://${creds.apihost}/api/v1/`, authHandler: undefined, noUserAgent: undefined})
        expect(typeof nimbellaProvider._client).to.not.equal('undefined');
      })
    })

    it('should cache client instance', () => {
      nimbellaProvider._client = {}
      return nimbellaProvider.client().then(client => {
        expect(client).to.be.equal(nimbellaProvider._client)
      })
    })

    it('should support client auth using IBM Cloud IAM API key', () => {
      nimbellaProvider._client = null
      const API_KEY = 'some-key-value';
      const creds = {iam_namespace_api_key: API_KEY, apihost: 'some_api', namespace: 'a34dd39e-e3de-4160-bbab-59ac345678ed'}
      sandbox.stub(nimbellaProvider, "props").returns(BbPromise.resolve(creds))

      return nimbellaProvider.client().then(client => {
        expect(client.actions.client.options.namespace).to.be.deep.equal(creds.namespace)
        expect(client.actions.client.options.api).to.be.deep.equal(`https://${creds.apihost}/api/v1/`)
        expect(typeof client.actions.client.options.authHandler).to.not.equal('undefined')
        expect(client.actions.client.options.authHandler.iamApikey).to.be.deep.equal(API_KEY)
      })
    })

    it('should support client auth using IBM Cloud CLI configuration file', () => {
      nimbellaProvider._client = null
      const API_KEY = 'some-key-value';
      const creds = {apihost: 'region.functions.cloud.ibm.com', namespace: 'a34dd39e-e3de-4160-bbab-59ac345678ed'}
      sandbox.stub(nimbellaProvider, "props").returns(BbPromise.resolve(creds))

      return nimbellaProvider.client().then(client => {
        expect(client.actions.client.options.namespace).to.be.deep.equal(creds.namespace)
        expect(client.actions.client.options.api).to.be.deep.equal(`https://${creds.apihost}/api/v1/`)
        expect(client.actions.client.options.authHandler instanceof CliTokenManager).to.be.equal(true)
      })
    })
  })

  describe('#props()', () => {
    it('should return promise that resolves with provider credentials', () => {
      nimbellaProvider._props = null
      const creds = {apihost: 'some_api', auth: 'user:pass', namespace: 'namespace'}
      sandbox.stub(Credentials, "getWskProps").returns(BbPromise.resolve(creds))
      return nimbellaProvider.props().then(props => {
        expect(props).to.be.deep.equal({auth: creds.auth, namespace: creds.namespace, apihost: creds.apihost})
        expect(typeof nimbellaProvider._props).to.not.equal('undefined');
      })
    });

    it('should return cached provider credentials', () => {
      nimbellaProvider._props = {}
      const stub = sandbox.stub(Credentials, "getWskProps")
      return nimbellaProvider.props().then(props => {
        expect(props).to.be.equal(nimbellaProvider._props)
        expect(stub.called).to.be.equal(false)
      })
    });

    it('should reject promise when getWskProps rejects', () => {
      sandbox.stub(Credentials, "getWskProps").returns(BbPromise.reject())
      return expect(nimbellaProvider.props()).to.eventually.be.rejected;
    });
  });

  describe('#hasValidCreds()', () => {
    it('should throw error when parameter (AUTH) is missing', () => {
      const mockObject = {
        apihost: 'blah.blah.com', namespace: 'user@user.com',
      };

      return expect(() => nimbellaProvider.hasValidCreds(mockObject)).to.throw(/OW_AUTH/);
    });

    it('should throw error when parameter (APIHOST) is missing', () => {
      const mockObject = {
        auth: 'user:pass', namespace: 'user@user.com',
      };

      return expect(() => nimbellaProvider.hasValidCreds(mockObject)).to.throw(/OW_APIHOST/);
    });
  })
})
