import i18next from 'i18next';
import { useEffect, useState } from 'react';

import { TbLoader3 } from 'react-icons/tb';

export function notify({ title, tips, loading }) {
    return (
        <div className="w-[330px] h-auto p-[14px]">
            <div className="notify-icon">
                <TbLoader3 className="animate-spin" />
            </div>
            <p className="text-center text-[1.2rem] mb-[24px]">
                {title ?? 'Please wait...'}
            </p>

            {loading ?? true ? <LoadingProgressBar /> : null}
            {tips ?? true ? <Protip /> : null}
        </div>
    );
}

const LoadingProgressBar = () => {
    const [loading, setLoading] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            const randomNumber = Math.floor(Math.random() * 5) + 1;
            if (loading != 100) {
                setLoading((prevLoading) =>
                    prevLoading < 94 ? prevLoading + randomNumber : 99
                );
            }
        }, 3.5 * 1000);

        return () => clearInterval(interval);
    }, [loading]);

    return (
        <div className="loading-container !relative">
            <div className="loading-bar">
                <div
                    className="loading-progress"
                    style={{ width: `${loading}%` }}
                ></div>
            </div>
            <p className="loading-text">{true ? `${loading}%` : ''}</p>
        </div>
    );
};

const Protip = () => {
    const [currentTip, setCurrentTip] = useState(0);
    const listTip = [
        i18next.t('info.installApp'),
        i18next.t('info.pauseApp'),
        i18next.t('error.ALREADY_DEPLOYED')
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            const randomNumber = Math.floor(Math.random() * 3);

            setCurrentTip(randomNumber);
        }, 5 * 1000);

        return () => clearInterval(interval);
    }, []);
    return (
        <div className="mt-[14px]">
            <strong>Pro tip:</strong>
            <p>{listTip[currentTip]}</p>
        </div>
    );
};