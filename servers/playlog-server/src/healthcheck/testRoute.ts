import express from "express";
import { Router } from ".././rest/Router";

const expressApp = express();
const router = Router.create({} as any);
expressApp.use("/", router);

export default expressApp;
