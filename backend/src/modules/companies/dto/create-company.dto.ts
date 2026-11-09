import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsString()
  ceoName: string;

  @IsEmail()
  ceoEmail: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  ceoPassword: string;

  @IsArray()
  moduleKeys: string[]

  @IsOptional()
  @IsString()
  plan?: string;

  // The owner's login ID is <ownerUsername>@<slug>. Optional: taken from
  // the email when empty.
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/, {
    message: 'Login name: letters, numbers, dots, dashes or underscores',
  })
  ownerUsername?: string;
}