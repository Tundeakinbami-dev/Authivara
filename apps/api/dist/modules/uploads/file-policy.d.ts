export interface FilePolicyInput {
    fileName: string;
    mimeType: string;
    fileSize: number;
}
export interface AllowedFileType {
    category: string;
    extensions: readonly string[];
    mimeTypes: readonly string[];
    matchesSignature(header: Uint8Array): boolean;
}
export declare const allowedFileTypes: readonly AllowedFileType[];
export declare function validateFileDeclaration(input: FilePolicyInput, maxBytes: number): AllowedFileType;
export declare function validateFileSignature(input: FilePolicyInput, header: Uint8Array, maxBytes: number): AllowedFileType;
