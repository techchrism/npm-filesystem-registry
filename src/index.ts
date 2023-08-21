import logger from 'koa-logger'
import Koa from 'koa'
import querystring from 'node:querystring'
import path from 'node:path'
import {promises as fs} from 'node:fs'
import Router from '@koa/router'
import {RegistryResponse} from './npmTypes'
import koaBody from 'koa-body'

const packagesDir = process.argv[2]
const port = Number(process.argv[3])
if(packagesDir === undefined) {
    console.error('No packages directory specified!')
    console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <packages directory> <port>`)
    process.exit(1)
}
if(port === undefined || isNaN(port)) {
    console.error('No port specified!')
    console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <packages directory> <port>`)
    process.exit(1)
}

const app = new Koa()
app.use(logger())
app.use(koaBody())

const router = new Router()
router.get('/:id', async ctx => {
    const pkg = querystring.unescape(ctx.params.id)
    try {
        const data = JSON.parse(await fs.readFile(path.join(packagesDir, pkg, 'registry.json'), 'utf-8')) as RegistryResponse

        // Modify the registry response to only include versions that are available on disk
        // This is to prevent the client from trying to download versions that don't exist
        // (e.g. if the client wants the latest version but the server only has a specific older version but with the latest registry response)
        const availableVersions = (await fs.readdir(path.join(packagesDir, pkg, 'versions'))).map(v => v.substring(0, v.length - '.tgz'.length))
        const modified = {
            ...data,
            versions: {} as {[key: string]: any}
        }
        for(const version in data.versions) {
            if(availableVersions.includes(version)) {
                modified.versions[version] = data.versions[version]
            }
        }
        ctx.body = JSON.stringify(modified)
    } catch(ignored) {}
})

router.get('/:id+/-/:version.tgz', async ctx => {
    const pkg = querystring.unescape(ctx.params.id)

    try {
        const data = JSON.parse(await fs.readFile(path.join(packagesDir, pkg, 'registry.json'), 'utf-8')) as RegistryResponse
        const versionID = Object.values(data.versions).find(v => querystring.unescape(v.dist.tarball).endsWith(querystring.unescape(ctx.request.url)))?.version
        if(versionID !== undefined) {
            ctx.body = await fs.readFile(path.join(packagesDir, pkg, 'versions', `${versionID}.tgz`))
        }
    } catch(ignored) {}
})

router.put('/:id', async ctx => {
    const pkg = querystring.unescape(ctx.params.id)

    try {
        await fs.mkdir(path.join(packagesDir, pkg, 'versions'), {recursive: true})
    } catch(ignored) {}

    // Write attachments
    for(const attachmentFile in ctx.request.body._attachments) {
        const attachment = ctx.request.body._attachments[attachmentFile]
        const cleanedName = attachmentFile.substring(attachmentFile.lastIndexOf('-') + 1)
        await fs.writeFile(path.join(packagesDir, pkg, 'versions', cleanedName), Buffer.from(attachment.data, 'base64'))
    }

    const existingVersions = await (async () => {
        try {
            const existingReg = JSON.parse(await fs.readFile(path.join(packagesDir, pkg, 'registry.json'), 'utf-8')) as RegistryResponse
            return existingReg.versions
        } catch(e) {
            return {}
        }
    })()

    const {_id, access, _attachments, ...cleanData} = ctx.request.body
    const newReg = {
        ...cleanData,
        versions: {
            ...existingVersions,
            ...cleanData.versions
        },
        modified: (new Date()).toISOString()
    }
    await fs.writeFile(path.join(packagesDir, pkg, 'registry.json'), JSON.stringify(newReg))

    ctx.response.status = 200
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(port)
console.log(`Started listening on port ${port}!`)