import { Sequelize } from "sequelize";
import config from "config";

type DBHost = { host: string; port: number };

const waitSecond = 1;
let counter = 0; // will be increment
const limit = 60; // retry limit

const sequelize = new Sequelize({
	host: config.get<DBHost[]>("dbSettings.database.hosts")[0].host,
	port: config.get<DBHost[]>("dbSettings.database.hosts")[0].port,
	database: config.get<string>("dbSettings.database.database"),
	username: config.get<string>("dbSettings.database.user"),
	password: config.get<string>("dbSettings.database.password"),
	dialect: "mysql",
});

function log(message: string): void {
	console.log(message);
}

setInterval(async () => {
	if (limit < counter) {
		process.exit(1);
	}
	counter++;

	try {
		await sequelize.authenticate();
		// if success to connect and execute SELECT query
		process.exit(0);
	} catch (e) {
		log((e as any).toString());
	}
}, waitSecond * 1000);
