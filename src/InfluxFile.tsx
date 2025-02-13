import { TFile, CachedMetadata } from 'obsidian';
import { ApiAdapter, BacklinksObject, ExtendedInlinkingFile } from './apiAdapter';
import { InlinkingFile } from './InlinkingFile';
import ObsidianInflux from './main';
import { v4 as uuidv4 } from 'uuid';


export default class InfluxFile {
    uuid: string;
    api: ApiAdapter;
    influx: ObsidianInflux;
    file: TFile;
    meta: CachedMetadata;
    backlinks: BacklinksObject;
    inlinkingFiles: InlinkingFile[];
    components: ExtendedInlinkingFile[];
    show: boolean;
    collapsed: boolean;
    
    constructor(path: string, apiAdapter: ApiAdapter, influx: ObsidianInflux) {
        console.log(influx);

        this.uuid = uuidv4()
        this.api = apiAdapter
        this.influx = influx
        this.file = this.api.getFileByPath(path)
        this.meta = this.api.getMetadata(this.file)
        this.backlinks = this.api.getBacklinks(this.file)
        this.inlinkingFiles = []
        this.components = []
        this.show = this.api.getShowStatus(this.file)
        this.collapsed = this.api.getCollapsedStatus(this.file)

    }

    // is the file that triggers update part of the current files inlinked files?
    shouldUpdate(file: TFile) {
        this.backlinks = this.api.getBacklinks(this.file) // Must refresh in case of renamings.
        const paths = Object.keys(this.backlinks.data)
        return paths.includes(file.path)
    }

    // https://github.com/jensmtg/influx/issues/88#issuecomment-2591095816
    async makeInfluxList() {
        // 1. Get the Map from getBacklinks
        this.backlinks = this.api.getBacklinks(this.file);
        // 2. Create an array of valid paths
        const validPaths: string[] = [];
        
        for (const [pathAsKey, backlinkArray] of this.backlinks.data) {
            // Exclude current note & check if includable
            if (pathAsKey !== this.file.path && this.api.isIncludableSource(pathAsKey)) {
                validPaths.push(pathAsKey);
            }
        }
        
        // 3. Convert those paths to TFile objects
        const backlinksAsFiles = validPaths.map((pathAsKey) => this.api.getFileByPath(pathAsKey));
        
        // 4. Create InlinkingFile objects & do the summary calls
        const inlinkingFilesNew: InlinkingFile[] = [];
        await Promise.all(backlinksAsFiles.map(async (file) => {
            const inlinkingFile = new InlinkingFile(file, this.api);
            await inlinkingFile.makeSummary(this);
            inlinkingFilesNew.push(inlinkingFile);
        }));
        console.log(inlinkingFilesNew);
    
        // 5. Store them on this.inlinkingFiles
        this.inlinkingFiles = inlinkingFilesNew;
    }
        
    /*
    async makeInfluxList() {
        this.backlinks = this.api.getBacklinks(this.file) // Must refresh in case of renamings.
        const inlinkingFilesNew: InlinkingFile[] = []
        const backlinksAsFiles = Object.keys(this.backlinks.data)
            .filter((pathAsKey) => pathAsKey !== this.file.path // Exclude mentions of self
                && this.api.isIncludableSource(pathAsKey)) // Exclude by regex patterns
            .map((pathAsKey) => this.api.getFileByPath(pathAsKey))
        await Promise.all(backlinksAsFiles.map(async (file: TFile) => {
            const inlinkingFile = new InlinkingFile(file, this.api)
            await inlinkingFile.makeSummary(this)
            inlinkingFilesNew.push(inlinkingFile)
        }))
        this.inlinkingFiles = inlinkingFilesNew
    }
    */

    async renderAllMarkdownBlocks() {

        // Avoid rendering if no-show
        if (!this.show) {
            return
        }

        const components = await this.api.renderAllMarkdownBlocks(this.inlinkingFiles)
        this.components = components
        return components
    }


}

