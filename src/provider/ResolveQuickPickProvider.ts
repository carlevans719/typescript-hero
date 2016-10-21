import { ResolveIndex } from '../caches/ResolveIndex';
import { ResolveQuickPickItem } from '../models/QuickPickItems';
import { TsResourceParser } from '../parser/TsResourceParser';
import { Logger, LoggerFactory } from '../utilities/Logger';
import { getDeclarationsFilteredByImports } from '../utilities/ResolveIndexExtensions';
import { inject, injectable } from 'inversify';
import { TextDocument, window } from 'vscode';

@injectable()
export class ResolveQuickPickProvider {
    private logger: Logger;

    constructor( @inject('LoggerFactory') loggerFactory: LoggerFactory, private resolveIndex: ResolveIndex, private parser: TsResourceParser) {
        this.logger = loggerFactory('ResolveQuickPickProvider');
    }

    public async addImportPick(activeDocument: TextDocument): Promise<ResolveQuickPickItem> {
        let items = await this.buildQuickPickList(activeDocument);
        return window.showQuickPick<ResolveQuickPickItem>(items);
    }

    public async addImportUnderCursorPick(activeDocument: TextDocument, cursorSymbol: string): Promise<ResolveQuickPickItem> {
        let resolveItems = await this.buildQuickPickList(activeDocument, cursorSymbol);

        if (resolveItems.length < 1) {
            window.showInformationMessage(`The symbol '${cursorSymbol}' was not found in the index or is already imported.`);
            return;
        } else if (resolveItems.length === 1 && resolveItems[0].label === cursorSymbol) {
            return resolveItems[0];
        } else {
            return window.showQuickPick(resolveItems, { placeHolder: 'Multiple declarations found:' });
        }
    }

    private async buildQuickPickList(activeDocument: TextDocument, cursorSymbol?: string): Promise<ResolveQuickPickItem[]> {
        let parsedSource = await this.parser.parseSource(activeDocument.getText()),
            declarations = getDeclarationsFilteredByImports(this.resolveIndex, activeDocument.fileName, parsedSource.imports);

        if (cursorSymbol) {
            declarations = declarations.filter(o => o.declaration.name.startsWith(cursorSymbol));
        }

        let activeDocumentDeclarations = parsedSource.declarations.map(o => o.name);

        declarations = [
            ...declarations.filter(o => o.from.startsWith('/')),
            ...declarations.filter(o => !o.from.startsWith('/'))
        ];

        return declarations.filter(o => activeDocumentDeclarations.indexOf(o.declaration.name) === -1).map(o => new ResolveQuickPickItem(o));
    }
}