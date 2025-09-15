import { Container, Label } from '@playcanvas/pcui';
import { Mat4, Vec3 } from 'playcanvas';

import { Events } from '../events';
import { ExportPopup } from './export-popup';
import { ImageSettingsDialog } from './image-settings-dialog';
import { localize, localizeInit } from './localization';
import logo from './playcanvas-logo.png';
import { Popup, ShowOptions } from './popup';
import { Progress } from './progress';
import { PublishSettingsDialog } from './publish-settings-dialog';
import { ShortcutsPopup } from './shortcuts-popup';
import { Spinner } from './spinner';
import { Tooltips } from './tooltips';
import { VideoSettingsDialog } from './video-settings-dialog';
import { ViewCube } from './view-cube';

class EditorUI {
    appContainer: Container;
    topContainer: Container;
    canvasContainer: Container;
    toolsContainer: Container;
    canvas: HTMLCanvasElement;
    popup: Popup;

    constructor(events: Events, remoteStorageMode: boolean) {
        localizeInit();

        // favicon
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = logo;
        document.head.appendChild(link);

        // app
        const appContainer = new Container({
            id: 'app-container'
        });

        // editor
        const editorContainer = new Container({
            id: 'editor-container'
        });

        // tooltips container
        const tooltipsContainer = new Container({
            id: 'tooltips-container'
        });

        // top container
        const topContainer = new Container({
            id: 'top-container'
        });

        // canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas';

        // cursor label (keeping for coordinate display functionality)
        const cursorLabel = new Label({
            id: 'cursor-label'
        });

        let fullprecision = '';

        events.on('camera.focalPointPicked', (details: { position: Vec3 }) => {
            cursorLabel.text = `${details.position.x.toFixed(2)}, ${details.position.y.toFixed(2)}, ${details.position.z.toFixed(2)}`;
            fullprecision = `${details.position.x}, ${details.position.y}, ${details.position.z}`;
        });

        ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'dblclick'].forEach((eventName) => {
            cursorLabel.dom.addEventListener(eventName, (event: Event) => event.stopPropagation());
        });

        cursorLabel.dom.addEventListener('pointerdown', () => {
            navigator.clipboard.writeText(fullprecision);

            const orig = cursorLabel.text;
            cursorLabel.text = localize('cursor.copied');
            setTimeout(() => {
                cursorLabel.text = orig;
            }, 1000);
        });

        // canvas container
        const canvasContainer = new Container({
            id: 'canvas-container'
        });

        // tools container
        const toolsContainer = new Container({
            id: 'tools-container'
        });

        // tooltips
        const tooltips = new Tooltips();
        tooltipsContainer.append(tooltips);

        canvasContainer.dom.appendChild(canvas);
        canvasContainer.append(cursorLabel);
        canvasContainer.append(toolsContainer);

        // view axes container
        const viewCube = new ViewCube(events);
        canvasContainer.append(viewCube);
        events.on('prerender', (cameraMatrix: Mat4) => {
            viewCube.update(cameraMatrix);
        });

        // main container
        const mainContainer = new Container({
            id: 'main-container'
        });

        mainContainer.append(canvasContainer);

        editorContainer.append(mainContainer);

        // tooltips.register(cursorLabel, localize('cursor.click-to-copy'), 'top');

        // message popup
        const popup = new Popup(tooltips);

        // shortcuts popup
        const shortcutsPopup = new ShortcutsPopup();

        // export popup
        const exportPopup = new ExportPopup(events);

        // publish settings
        const publishSettingsDialog = new PublishSettingsDialog(events);

        // image settings
        const imageSettingsDialog = new ImageSettingsDialog(events);

        // video settings
        const videoSettingsDialog = new VideoSettingsDialog(events);

        topContainer.append(popup);
        topContainer.append(exportPopup);
        topContainer.append(publishSettingsDialog);
        topContainer.append(imageSettingsDialog);
        topContainer.append(videoSettingsDialog);

        appContainer.append(editorContainer);
        appContainer.append(topContainer);
        appContainer.append(tooltipsContainer);
        appContainer.append(shortcutsPopup);

        this.appContainer = appContainer;
        this.topContainer = topContainer;
        this.canvasContainer = canvasContainer;
        this.toolsContainer = toolsContainer;
        this.canvas = canvas;
        this.popup = popup;

        document.body.appendChild(appContainer.dom);
        document.body.setAttribute('tabIndex', '-1');

        events.on('show.shortcuts', () => {
            shortcutsPopup.hidden = false;
        });

        events.function('show.exportPopup', (exportType, splatNames: [string], showFilenameEdit: boolean) => {
            return exportPopup.show(exportType, splatNames, showFilenameEdit);
        });

        events.function('show.publishSettingsDialog', async () => {
            // show popup if user isn't logged in
            const canPublish = await events.invoke('publish.enabled');
            if (!canPublish) {
                await events.invoke('showPopup', {
                    type: 'error',
                    header: localize('popup.error'),
                    message: localize('publish.please-log-in')
                });
                return false;
            }

            // get user publish settings
            const publishSettings = await publishSettingsDialog.show();

            // do publish
            if (publishSettings) {
                await events.invoke('scene.publish', publishSettings);
            }
        });

        events.function('show.imageSettingsDialog', async () => {
            const imageSettings = await imageSettingsDialog.show();

            if (imageSettings) {
                await events.invoke('render.image', imageSettings);
            }
        });

        events.function('show.videoSettingsDialog', async () => {
            const videoSettings = await videoSettingsDialog.show();

            if (videoSettings) {
                await events.invoke('render.video', videoSettings);
            }
        });

        events.function('show.about', () => {
            return this.popup.show({
                type: 'info',
                header: 'About',
                message: `SuperSplat (Headless Mode)`
            });
        });

        events.function('showPopup', (options: ShowOptions) => {
            return this.popup.show(options);
        });

        // spinner

        const spinner = new Spinner();

        topContainer.append(spinner);

        events.on('startSpinner', () => {
            spinner.hidden = false;
        });

        events.on('stopSpinner', () => {
            spinner.hidden = true;
        });

        // progress

        const progress = new Progress();

        topContainer.append(progress);

        events.on('progressStart', (header: string) => {
            progress.hidden = false;
            progress.setHeader(header);
        });

        events.on('progressUpdate', (options: { text: string, progress: number }) => {
            progress.setText(options.text);
            progress.setProgress(options.progress);
        });

        events.on('progressEnd', () => {
            progress.hidden = true;
        });

        // initialize canvas to correct size before creating graphics device etc
        const pixelRatio = window.devicePixelRatio;
        canvas.width = Math.ceil(canvasContainer.dom.offsetWidth * pixelRatio);
        canvas.height = Math.ceil(canvasContainer.dom.offsetHeight * pixelRatio);

        ['contextmenu', 'gesturestart', 'gesturechange', 'gestureend'].forEach((event) => {
            document.addEventListener(event, (e) => {
                e.preventDefault();
            }, true);
        });

        // whenever the canvas container is clicked, set keyboard focus on the body
        canvasContainer.dom.addEventListener('pointerdown', (event: PointerEvent) => {
            // set focus on the body if user is busy pressing on the canvas or a child of the tools
            // element
            if (event.target === canvas || toolsContainer.dom.contains(event.target as Node)) {
                document.body.focus();
            }
        }, true);
    }
}

export { EditorUI };
