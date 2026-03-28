export namespace main {
	
	export class BootstrapData {
	    settings: storage.Settings;
	    projects: storage.Project[];
	    activeProjectId: string;
	    environments: storage.Environment[];
	    activeEnvId: string;
	    tree: storage.TreeNode[];
	    selectedRequestId: string;
	    selectedRequest: storage.Request;
	
	    static createFrom(source: any = {}) {
	        return new BootstrapData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.settings = this.convertValues(source["settings"], storage.Settings);
	        this.projects = this.convertValues(source["projects"], storage.Project);
	        this.activeProjectId = source["activeProjectId"];
	        this.environments = this.convertValues(source["environments"], storage.Environment);
	        this.activeEnvId = source["activeEnvId"];
	        this.tree = this.convertValues(source["tree"], storage.TreeNode);
	        this.selectedRequestId = source["selectedRequestId"];
	        this.selectedRequest = this.convertValues(source["selectedRequest"], storage.Request);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CreateRequestResult {
	    node: storage.Node;
	    request: storage.Request;
	
	    static createFrom(source: any = {}) {
	        return new CreateRequestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.node = this.convertValues(source["node"], storage.Node);
	        this.request = this.convertValues(source["request"], storage.Request);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace storage {
	
	export class Auth {
	    type: string;
	    bearerToken?: string;
	    basicUser?: string;
	    basicPass?: string;
	    apiKeyIn?: string;
	    apiKeyName?: string;
	    apiKeyValue?: string;
	
	    static createFrom(source: any = {}) {
	        return new Auth(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.bearerToken = source["bearerToken"];
	        this.basicUser = source["basicUser"];
	        this.basicPass = source["basicPass"];
	        this.apiKeyIn = source["apiKeyIn"];
	        this.apiKeyName = source["apiKeyName"];
	        this.apiKeyValue = source["apiKeyValue"];
	    }
	}
	export class BodyField {
	    enabled: boolean;
	    key: string;
	    value?: string;
	    type?: string;
	    description?: string;
	    isFile?: boolean;
	    filePath?: string;
	
	    static createFrom(source: any = {}) {
	        return new BodyField(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.key = source["key"];
	        this.value = source["value"];
	        this.type = source["type"];
	        this.description = source["description"];
	        this.isFile = source["isFile"];
	        this.filePath = source["filePath"];
	    }
	}
	export class Body {
	    type: string;
	    jsonText?: string;
	    text?: string;
	    fields?: BodyField[];
	
	    static createFrom(source: any = {}) {
	        return new Body(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.jsonText = source["jsonText"];
	        this.text = source["text"];
	        this.fields = this.convertValues(source["fields"], BodyField);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Environment {
	    id: string;
	    projectId: string;
	    name: string;
	    baseUrl: string;
	    vars: Record<string, string>;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.name = source["name"];
	        this.baseUrl = source["baseUrl"];
	        this.vars = source["vars"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class KV {
	    enabled: boolean;
	    key: string;
	    value: string;
	    type: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new KV(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.key = source["key"];
	        this.value = source["value"];
	        this.type = source["type"];
	        this.description = source["description"];
	    }
	}
	export class Node {
	    id: string;
	    projectId: string;
	    parentId?: string;
	    type: string;
	    name: string;
	    sortIndex: number;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Node(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.parentId = source["parentId"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.sortIndex = source["sortIndex"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class Project {
	    id: string;
	    name: string;
	    activeEnvId?: string;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.activeEnvId = source["activeEnvId"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class Request {
	    id: string;
	    nodeId: string;
	    method: string;
	    urlMode: string;
	    urlFull: string;
	    path: string;
	    queryParams: KV[];
	    headers: KV[];
	    body: Body;
	    auth: Auth;
	    description: string;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.nodeId = source["nodeId"];
	        this.method = source["method"];
	        this.urlMode = source["urlMode"];
	        this.urlFull = source["urlFull"];
	        this.path = source["path"];
	        this.queryParams = this.convertValues(source["queryParams"], KV);
	        this.headers = this.convertValues(source["headers"], KV);
	        this.body = this.convertValues(source["body"], Body);
	        this.auth = this.convertValues(source["auth"], Auth);
	        this.description = source["description"];
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SendResult {
	    ok: boolean;
	    error?: string;
	    status: number;
	    statusText?: string;
	    durationMs: number;
	    sizeBytes: number;
	    headers: Record<string, Array<string>>;
	    body: string;
	
	    static createFrom(source: any = {}) {
	        return new SendResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.error = source["error"];
	        this.status = source["status"];
	        this.statusText = source["statusText"];
	        this.durationMs = source["durationMs"];
	        this.sizeBytes = source["sizeBytes"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	    }
	}
	export class Settings {
	    theme: string;
	    language: string;
	    requestTimeoutMs: number;
	    autoSave: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.language = source["language"];
	        this.requestTimeoutMs = source["requestTimeoutMs"];
	        this.autoSave = source["autoSave"];
	    }
	}
	export class TreeNode {
	    id: string;
	    type: string;
	    name: string;
	    requestId?: string;
	    method?: string;
	    children?: TreeNode[];
	
	    static createFrom(source: any = {}) {
	        return new TreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.requestId = source["requestId"];
	        this.method = source["method"];
	        this.children = this.convertValues(source["children"], TreeNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

