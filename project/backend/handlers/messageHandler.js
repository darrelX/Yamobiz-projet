import {
    getOrCreateUser
} from "../services/userService.js";


import {
    getBusinessByUserId
} from "../services/businessService.js";


import {
    handleRegistration
} from "./registrationHandler.js";

const user = await getOrCreateUser(phone);

const business = await getBusinessByUserId(user.id);

if (!business) {

    return handleRegistration(
        phone,
        text,
        conversation,
        user
    );

}