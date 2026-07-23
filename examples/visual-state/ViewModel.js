import { Field, ViewModel } from "../../BindifyJS.js";

class VisualStateViewModel extends ViewModel {
    static fields = {
        progress: Field.integer()
            .alsoChanges("complete", "legenda"),
        accentColor: Field.string()
    };

    progress = 20;
    accentColor = "#19734a";

    get complete() {
        return this.progress >= 100;
    }

    get legenda() {
        return `${this.progress}%`;
    }

    avancar() {
        this.progress = Math.min(100, this.progress + 20);
    }
}

globalThis.VisualStateViewModel = VisualStateViewModel;
