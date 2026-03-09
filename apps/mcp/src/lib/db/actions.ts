import * as schema from "../../../auth-schema.js";
import { userWallets } from "../../../auth-schema.js";
import { db } from "../auth.js";

export type Wallet = Omit<typeof userWallets.$inferSelect, 'walletMetadata'> & { walletMetadata: unknown }
