const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Gdk, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const Settings = Me.imports.settings;

const { AboutPage } = Settings.AboutPage;
const { GeneralPage } = Settings.GeneralPage;
const { MenuPage } = Settings.MenuPage;
const { MenuButtonPage } = Settings.MenuButtonPage;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function populateWindow(window, settings){
    if(window.pages?.length > 0){
        window.pages.forEach(page => window.remove(page));
    }

    window.pages = [];

    const generalPage = new GeneralPage(settings);
    window.add(generalPage);
    window.pages.push(generalPage);

    const menuPage = new MenuPage(settings);
    window.add(menuPage);
    window.pages.push(menuPage);

    const menuButtonPage = new MenuButtonPage(settings);
    window.add(menuButtonPage);
    window.pages.push(menuButtonPage);

    const aboutPage = new AboutPage(settings, window);
    window.add(aboutPage);
    window.pages.push(aboutPage);

    setVisiblePage(window, settings);
}

function setVisiblePage(window, settings){
    const prefsVisiblePage = settings.get_int('prefs-visible-page');


    if(prefsVisiblePage === Constants.PrefsVisiblePage.MAIN)
        window.set_visible_page_name('GeneralPage');
    else if(prefsVisiblePage === Constants.PrefsVisiblePage.CUSTOMIZE_MENU){
        window.set_visible_page_name('MenuPage');
        let page = window.get_visible_page();
        page.mainLeaflet.visible_child_name = 'MainView';
    }
    else if(prefsVisiblePage === Constants.PrefsVisiblePage.MENU_LAYOUT){
        window.set_visible_page_name('MenuPage');
        let page = window.get_visible_page();
        page.subLeaflet.visible_child_name = 'LayoutsPage';
        page.mainLeaflet.visible_child = page.subLeaflet;
    }
    else if(prefsVisiblePage === Constants.PrefsVisiblePage.BUTTON_APPEARANCE){
        window.set_visible_page_name("MenuButtonPage");
    }
    else if(prefsVisiblePage === Constants.PrefsVisiblePage.LAYOUT_TWEAKS){
        window.set_visible_page_name('MenuPage');
        let page = window.get_visible_page();
        page.subLeaflet.visible_child_name = 'LayoutTweaksPage';
        page.mainLeaflet.visible_child = page.subLeaflet;
    }
    else if(prefsVisiblePage === Constants.PrefsVisiblePage.RUNNER_TWEAKS){
        window.set_visible_page_name('vPage');
        let page = window.get_visible_page();
        page.subLeaflet.visible_child_name = 'LayoutTweaksPage';
        const tweaksPage = page.subLeaflet.visible_child;
        page.mainLeaflet.visible_child = page.subLeaflet;
        tweaksPage.setActiveLayout(Constants.MenuLayout.RUNNER);
    }
    else if(prefsVisiblePage === Constants.PrefsVisiblePage.ABOUT)
        window.set_visible_page_name("AboutPage");
    else if(prefsVisiblePage === Constants.PrefsVisiblePage.GENERAL)
        window.set_visible_page_name("GeneralPage");
    else if(prefsVisiblePage === Constants.PrefsVisiblePage.MENU_THEME){
        window.set_visible_page_name("MenuPage");
        let page = window.get_visible_page();
        page.subLeaflet.visible_child_name = 'ThemePage';
        page.mainLeaflet.visible_child = page.subLeaflet;
    }

    settings.set_int('prefs-visible-page', Constants.PrefsVisiblePage.MAIN);
}

function fillPreferencesWindow(window) {
    const settings = ExtensionUtils.getSettings();

    let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    if(!iconTheme.get_search_path().includes(Me.path + "/media/icons/prefs_icons"))
        iconTheme.add_search_path(Me.path + "/media/icons/prefs_icons");

    window.set_search_enabled(true);

    settings.connect("changed::prefs-visible-page", () => {
        if(settings.get_int('prefs-visible-page') !== Constants.PrefsVisiblePage.MAIN)
            setVisiblePage(window, settings);
    });

    window.default_width = settings.get_int('settings-width');
    window.default_height = settings.get_int('settings-height');
    window.set_title(_("ArcMenu Settings"));

    //Force navigate to MenuPage's MainView leaflet
    window.connect('notify::visible-page', () => {
        if(window.visible_page_name === 'MenuPage'){
            const page = window.visible_page;
            page.mainLeaflet.visible_child_name = 'MainView';
        }
    });

    populateWindow(window, settings);
}