export interface RegistryResponse {
    name: string
    'dist-tags': {
        latest: string
    }
    versions: {
        [key: string]: {
            name: string
            version: string
            scripts?: {
                [key: string]: string
            }
            dependencies?: {
                [key: string]: string
            }
            devDependencies?: {
                [key: string]: string
            }
            peerDependencies?: {
                [key: string]: string
            }
            optionalDependencies?: {
                [key: string]: string
            }
            dist: {
                tarball: string
            }
            hasInstallScript?: boolean
        }
    }
}

export interface PackageSubmission extends RegistryResponse {
    _id: string
    access: null
    _attachments: {
        [filename: string]: {
            content_type: string
            data: string
            length: number
        }
    }
}