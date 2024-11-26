// ==UserScript==
// @name            saveAs.uc.js
// @long-description
// @description
/* 下载弹出页面添加【另存为】按钮

这个脚本最先是紫云飞开发的：https://files.cnblogs.com/ziyunfei/saveas.uc.js
*/
// @version         1.0.0
// @license         MIT License
// @compatibility   Firefox 72
// @charset         UTF-8
// @include         chrome://mozapps/content/downloads/unknownContentType.xhtml
// @include         chrome://mozapps/content/downloads/unknownContentType.xul
// @homepageURL     https://github.com/benzBrake/FirefoxCustomize/tree/master/userChromeJS
// ==/UserScript==
(function () {
    if (!location.href.startsWith("chrome://mozapps/content/downloads/unknownContentType.x")) return;
    if (!Services.prefs.getBoolPref("userChromeJS.downloadPlus.enableSaveAs", true)) return;
    const $C = (doc, tag, props) => {
        const el = doc.createXULElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (key.startsWith('on') && typeof value == "function") {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        }
        return el;
    }
    const { dialog } = window;
    let saveAs = $C(document, 'button', {
        id: 'save-as',
        label: "另存为",
        accesskey: 'E',
        oncommand: function () {
            const mainwin = Services.wm.getMostRecentWindow("navigator:browser");
            // 感谢 ycls006
            mainwin.eval("(" + mainwin.internalSave.toString().replace("let ", "").replace("var fpParams", "fileInfo.fileExt=null;fileInfo.fileName=aDefaultFileName;var fpParams") + ")")(dialog.mLauncher.source.asciiSpec, null, null, (document.querySelector("#locationText") ? document.querySelector("#locationText").value : dialog.mLauncher.suggestedFileName), null, null, false, null, null, null, null, null, false, null, mainwin.PrivateBrowsingUtils.isBrowserPrivate(mainwin.gBrowser.selectedBrowser), Services.scriptSecurityManager.getSystemPrincipal());
            close();
        }
    });
    let ins = dialog.dialogElement('unknownContentType').getButton('cancel');
    ins.before(saveAs);
})()
