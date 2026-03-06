import express = require("express");

interface Controller {
	middlewares?: (req: express.Request, res: express.Response, next: Function) => any[];
	get?: (req: express.Request, res: express.Response, next: Function) => any;
	post?: (req: express.Request, res: express.Response, next: Function) => any;
	put?: (req: express.Request, res: express.Response, next: Function) => any;
	delete?: (req: express.Request, res: express.Response, next: Function) => any;
	head?: (req: express.Request, res: express.Response, next: Function) => any;
	options?: (req: express.Request, res: express.Response, next: Function) => any;
	patch?: (req: express.Request, res: express.Response, next: Function) => any;
}
export = Controller;
