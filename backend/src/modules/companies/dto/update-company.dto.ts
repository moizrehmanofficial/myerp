import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  ceoName?: string;

  @IsOptional()
  @IsEmail()
  ceoEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  ceoPassword?: string;

  @IsOptional()
  @IsArray()
  moduleKeys?: string[];

  @IsOptional()
  @IsString()
  plan?: string;

  // Owner's login name: the part before @ in <name>@<company code>
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/, {
    message: 'Login name: letters, numbers, dots, dashes or underscores',
  })
  ownerUsername?: string;
}
