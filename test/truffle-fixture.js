const initial_migration = require('../migrations/10_initial_migration')
const deploy_contracts = require('../migrations/20_deploy_contracts')


module.exports = async () => {
	await initial_migration()
	await deploy_contracts()
};
