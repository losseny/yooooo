import { Expose } from 'class-transformer';

export class ShippingAddressDto {
  @Expose()
  name: string;
  @Expose()
  phone: string;
  @Expose()
  address1: string;
  @Expose()
  address2: string;
  @Expose()
  city: string;
  @Expose()
  country: string;
  @Expose()
  province: string;
  @Expose()
  zip: string;
  @Expose()
  country_code: string;
}
