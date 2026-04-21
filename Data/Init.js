let searchParams = new URLSearchParams(window.location.search);
let searchKeyword = searchParams.get("u");
document.addEventListener("DOMContentLoaded", function () {
    // Load header
    fetch("/vanilla/HTML/header.html")
        .then((res) => res.text())
        .then((html) => {
            document.body.insertAdjacentHTML("afterbegin", html);

            requireAjax("/vanilla/Data/src/settings.js", function () {
                requireAjax("/vanilla/Data/src/dataloader.js", function () {
                    requireAjax("/vanilla/Data/src/tooltips.js", function () {
                        requireAjax("/vanilla/Data/src/lookuputils.js", function () {
                            requireAjax("/vanilla/Data/Search.js", function () {
                                requireAjax("/vanilla/Data/Faction.js", function () {
                                    requireAjax("/vanilla/Data/Builder.js", function () {
                                        CheckData();
                                        // wait for a while and then  HandleExtraTooltips();
                                        setTimeout(function () {
                                            HandleExtraTooltips();
                                        }, 2000);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
});



function requireAjax(file, callback) {
    jQuery.getScript(file, callback);
}
