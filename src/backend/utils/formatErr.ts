import i18next from 'i18next';
import { externalLink } from './constant';
import { log } from './log';

const listErr = [
    {
        msg: 'ran out of hardware',
        text: ['error.run_out_of_gpu_stock', 'error.suggest']
    },
    {
        msg: 'ran out of gpu',
        text: ['error.run_out_of_gpu_stock', 'error.suggest']
    },
    {
        msg: 'is locked',
        text: ['error.IS_LOCKED', 'error.suggest']
    },
    {
        msg: 'worker not pinged',
        text: ['error.NOT_PINGED']
    },
    {
        msg: 'cluster not exist or not active', //TODO
        text: ['Server is down!', 'error.suggest']
    },
    {
        msg: 'timeout', //TODO
        text: ['error.TIME_OUT']
    }
];
const includesErr = (err = '') => {
    let errFormat = '';
    for (let i = 0; i < listErr.length; i++) {
        if (JSON.stringify(err)?.includes(listErr[i].msg)) {
            listErr[i].text.forEach((txt) => {
                errFormat += i18next.t(txt) + ' ';
            });
            break;
        }
    }

    return errFormat;
};
export async function formatError(err = 'Something went wrong!', code = '0') {
    const directDiscordMsg = ` Join <a target='_blank' href=${externalLink.DISCORD_LINK}>Thinkmay Discord</a> for support.`;

    const CAUSES = {
        '0': JSON.stringify(err),
        '1': i18next.t('error.run_out_of_gpu_stock'),
        '2': i18next.t('error.ALREADY_DEPLOYED'),
        '3': 'INVALID_AUTH_HEADER',
        '4': 'DATABASE_ERROR',
        '5': i18next.t('error.NOT_FOUND'),
        '6': i18next.t('error.TIME_OUT'),
        '999': JSON.stringify(err) //Frontend Err
    };

    let icon = code != '0' ? 'info' : 'error';
    let msg =
        (CAUSES as any as [string, string])[code as any] ?? JSON.stringify(err);
    if (includesErr(err) != '') {
        msg = includesErr(err);
        icon = 'info';
    }
    const template = `<p> <b class='uppercase'>${msg}. </b>
						</br> 
						${directDiscordMsg} 
					  <p>`;

    await log({
        type: 'error',
        icon: icon,
        title: icon == 'info' ? 'Notice:' : icon,
        content: template
    });

    return template;
}