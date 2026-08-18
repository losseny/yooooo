import {GigaB2bService} from "./giga-b2b.service";

(async () => {
    const gigaService: GigaB2bService = new GigaB2bService();

    for await (const details of gigaService.importExternalMarketProducts()) {
        // console.log(JSON.stringify(details, null, 2));
        console.log()
        console.log()
        console.log("=================================================================================")
    }

})()