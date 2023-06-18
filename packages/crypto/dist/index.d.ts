// Generated by dts-bundle-generator v8.0.1

/**
 * Generate Token that used for authentication
 * @param subject
 * @returns token
 */
export declare const generateToken: (subject: string) => Promise<{
	token: string;
	dbToken: string;
}>;
/**
 * Decrypt Jwe token
 * @param jwe
 * @returns Promise
 */
export declare const decyptToken: (jwe: string) => Promise<import("jose").JWTPayload>;

export {};
