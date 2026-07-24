/** Buzz / Nostr kind numbers we care about in Cockpit. */
export const KIND_METADATA = 0;
export const KIND_REACTION = 7;
export const KIND_STREAM_MESSAGE = 9;
export const KIND_AUTH = 22242;
export const KIND_GROUP_META = 39000;
export const KIND_GROUP_ADMINS = 39001;
export const KIND_GROUP_MEMBERS = 39002;
export const KIND_CREATE_GROUP = 9007;
export const KIND_ADD_USER = 9000;
export const KIND_MEMBER_ADDED = 44100;
export const KIND_MEMBER_REMOVED = 44101;
export const KIND_JOB_REQUEST = 43001;
export const KIND_JOB_PROGRESS = 43003;
export const KIND_JOB_RESULT = 43004;
export const KIND_APPROVAL_REQUEST = 46010;
export const KIND_AGENT_OBSERVER = 24200;
export const KIND_SYSTEM_MESSAGE = 40099;
/** NIP-AP persona definition (owner-published blueprint). */
export const KIND_PERSONA = 30175;
/** NIP-AP managed-agent public projection (owner-published; d = agent pubkey). */
export const KIND_MANAGED_AGENT = 30177;
