import { AMFlowLike } from "./AMFlowLike";
import { Session } from "./Session";

export interface Factory {
	createAMFlow(session: Session): AMFlowLike;
}
