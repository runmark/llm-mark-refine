import { PrefixPathnameNormalizer } from "next/dist/server/future/normalizers/request/prefix";
import React from "react";


type Props = {
    message: string;
};

const UserMessageComponent: React.FC<Props> = ({ message }) => {

    return (
        <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4">
            <div className="flex items-center">
                {/* 3. Render Message component*/}
                <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">{message}</h2>
            </div>
        </div>
    );
}

export default UserMessageComponent;