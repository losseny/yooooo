import {BaseEntity} from './base.entity';
import * as crypto from 'crypto';

export abstract class BaseWithEncryptionEntity<T = any> extends BaseEntity {
    private static readonly IV_LENGTH: number = 16;
    public data: T;
    private encryptedData: Buffer;
    private ivData: Buffer;

    public encryptData() {
        if (!this.data) {
            throw new Error('EnvironmentConfig is undefined or null');
        }

        this.ivData = crypto.randomBytes(BaseWithEncryptionEntity.IV_LENGTH);

        const cipher = crypto.createCipheriv(
            'aes-256-cbc',
            Buffer.from("process.env.CONFIG_ENCRYPTION_KEY"),
            this.ivData,
        );

        let encrypted: string = cipher.update(
            JSON.stringify(this.data),
            'utf8',
            'hex',
        );
        encrypted += cipher.final('hex');
        this.encryptedData = Buffer.from(encrypted, 'hex');
    }

    protected decryptData() {
        try {
            const decipher = crypto.createDecipheriv(
                'aes-256-cbc',
                Buffer.from("process.env.CONFIG_ENCRYPTION_KEY"),
                this.ivData,
            );
            let decrypted: string = decipher.update(
                this.encryptedData.toString('hex'),
                'hex',
                'utf8',
            );
            decrypted += decipher.final('utf8');

            this.data = {...JSON.parse(decrypted)};
        } catch (e) {
            console.error('Error decrypting config keys for external platforms:', e);
            return null;
        }
    }
}
